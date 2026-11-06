"""Pure, fail-closed paper ledger reducer; never submits orders or accesses accounts."""
from decimal import Decimal, InvalidOperation


class PaperLedgerError(ValueError):
    pass


def _amount(value, *, positive=False):
    if isinstance(value, (bool, float)):
        raise PaperLedgerError("use exact decimal strings")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise PaperLedgerError("invalid amount") from None
    if not result.is_finite() or result < 0 or (positive and result == 0):
        raise PaperLedgerError("invalid amount")
    return result


def replay_paper_ledger(events, *, initial_cash="1000", max_order="400",
                        max_position="400"):
    """Replay append-only fills with unique IDs and strict EUR exposure limits.

    Each event: {id, side: BUY|SELL, quantity, price, fee}.
    Fee is EUR; all monetary values are exact Decimal strings.
    No margin, short selling, mutable balances, or private exchange calls.
    """
    cash = _amount(initial_cash)
    order_cap = _amount(max_order, positive=True)
    position_cap = _amount(max_position, positive=True)
    if not isinstance(events, (list, tuple)):
        raise PaperLedgerError("invalid journal")
    quantity = Decimal("0")
    ids = set()
    for event in events:
        if not isinstance(event, dict) or set(event) != {"id", "side", "quantity", "price", "fee"}:
            raise PaperLedgerError("invalid event schema")
        eid = event["id"]
        if not isinstance(eid, str) or not eid or len(eid) > 128 or eid in ids:
            raise PaperLedgerError("duplicate or invalid order id")
        ids.add(eid)
        qty = _amount(event["quantity"], positive=True)
        price = _amount(event["price"], positive=True)
        fee = _amount(event["fee"])
        notional = qty * price
        if notional > order_cap:
            raise PaperLedgerError("order cap exceeded")
        if event["side"] == "BUY":
            if notional + fee > cash:
                raise PaperLedgerError("insufficient cash")
            if (quantity + qty) * price > position_cap:
                raise PaperLedgerError("position cap exceeded")
            cash -= notional + fee
            quantity += qty
        elif event["side"] == "SELL":
            if qty > quantity:
                raise PaperLedgerError("short selling prohibited")
            if fee > notional:
                raise PaperLedgerError("fee exceeds proceeds")
            cash += notional - fee
            quantity -= qty
        else:
            raise PaperLedgerError("unsupported side")
    return {"cash_eur": str(cash), "quantity": str(quantity),
            "processed_orders": len(ids), "mode": "PAPER_ONLY"}
