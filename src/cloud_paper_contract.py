"""Pure cloud-paper event contract. No network, exchange, or execution capability.

This module is a prototype for a future single-writer Durable Object backend.
It validates an immutable sequence of accepted virtual fills, including
idempotency, monotonic revisions, risk bounds and persistent halt state.
"""
from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation
from typing import Tuple

MAX_POSITIONS = 3
MAX_POSITION_EUR = Decimal("150")
MAX_GROSS_EUR = Decimal("450")
START_CASH = Decimal("1000")


class ContractError(ValueError):
    pass


def money(value):
    if isinstance(value, bool):
        raise ContractError("boolean is not an amount")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ContractError("invalid amount") from None
    if not number.is_finite() or number < 0:
        raise ContractError("non-finite or negative amount")
    return number


@dataclass(frozen=True)
class Fill:
    order_id: str
    sequence: int
    symbol: str
    side: str
    quantity: str
    price_eur: str
    fee_eur: str


@dataclass(frozen=True)
class PaperState:
    sequence: int = 0
    cash: Decimal = START_CASH
    positions: Tuple[Tuple[str, Decimal, Decimal], ...] = ()
    halted: bool = False
    order_ids: Tuple[str, ...] = ()


def halt(state: PaperState) -> PaperState:
    return replace(state, halted=True)


def apply_fill(state: PaperState, fill: Fill) -> PaperState:
    """Apply one *already accepted* virtual fill. Duplicate IDs are no-ops.

    Caller must atomically persist the new state and event before acknowledging.
    This function is NOT a transactional store and cannot authorize live orders.
    """
    if not isinstance(fill.order_id, str) or not (1 <= len(fill.order_id) <= 128):
        raise ContractError("invalid order id")
    if fill.order_id in state.order_ids:
        raise ContractError("duplicate order id: compare payload in durable store")
    if state.halted:
        raise ContractError("paper halt active")
    if not isinstance(fill.sequence, int) or isinstance(fill.sequence, bool) or fill.sequence != state.sequence + 1:
        raise ContractError("out-of-order sequence")
    if not isinstance(fill.symbol, str) or not fill.symbol or len(fill.symbol) > 24:
        raise ContractError("invalid symbol")
    if fill.side not in ("BUY", "SELL"):
        raise ContractError("unsupported side")
    qty, price, fee = money(fill.quantity), money(fill.price_eur), money(fill.fee_eur)
    if qty <= 0 or price <= 0:
        raise ContractError("zero fill")
    notional = qty * price
    if fee > notional:
        raise ContractError("excessive fee")
    holdings = {symbol: (units, cost) for symbol, units, cost in state.positions}
    units, cost = holdings.get(fill.symbol, (Decimal("0"), Decimal("0")))
    cash = state.cash
    if fill.side == "BUY":
        total = notional + fee
        if total > cash:
            raise ContractError("insufficient paper cash")
        if cost + total > MAX_POSITION_EUR:
            raise ContractError("position cap exceeded")
        if fill.symbol not in holdings and len(holdings) >= MAX_POSITIONS:
            raise ContractError("position count exceeded")
        if sum(pcost for _, pcost in holdings.values()) + total > MAX_GROSS_EUR:
            raise ContractError("gross exposure exceeded")
        cash -= total
        holdings[fill.symbol] = (units + qty, cost + total)
    else:
        if units <= 0 or qty > units:
            raise ContractError("paper short selling prohibited")
        cash += notional - fee
        remaining = units - qty
        if remaining == 0:
            del holdings[fill.symbol]
        else:
            holdings[fill.symbol] = (remaining, cost * remaining / units)
    return PaperState(
        sequence=fill.sequence, cash=cash,
        positions=tuple(sorted((symbol, *values) for symbol, values in holdings.items())),
        halted=False, order_ids=state.order_ids + (fill.order_id,),
    )
