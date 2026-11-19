from pathlib import Path
from playwright.sync_api import sync_playwright
html = (Path(__file__).resolve().parents[1] / 'puck-pulse' / 'index.html').read_text().replace("if(new URLSearchParams(location.search).has('test'))", "if(true)")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    for label, viewport in [('iphone', {'width':390,'height':844}), ('landscape', {'width':844,'height':390}), ('tablet', {'width':1024,'height':768})]:
        context = browser.new_context(viewport=viewport, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        assert page.locator('[data-tab]').count() == 3
        assert page.locator('#overlay').evaluate('(el)=>getComputedStyle(el).overflowY') == 'hidden'
        assert page.evaluate('document.scrollingElement.scrollHeight <= document.documentElement.clientHeight + 2'), f'Menu scroll at {label}'
        page.locator('[data-mode="local"]').click()
        page.locator('[data-tab="arenas"]').click()
        assert page.locator('.arena').count() == 6
        assert page.locator('[data-theme="lava"] .arena-emblem').is_visible()
        page.locator('[data-theme="lava"]').click()
        page.locator('#arenaDone').click()
        page.locator('#startBtn').click()
        page.wait_for_timeout(120)
        state = page.evaluate('window.__pp.getState()')
        assert state['page'] == 'game' and state['mode'] == 'local' and state['theme'] == 'lava', state
        page.evaluate('window.scrollTo(0, 600)')
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        assert page.evaluate('window.scrollY') == 0, 'Game scrolled after swipe/scroll attempt'
        assert page.evaluate('window.__pp.getState().paused') is False, 'Game paused after transient Safari blur'
        page.evaluate('window.__pp.goal(0)')
        assert page.locator('#nearScore').inner_text() == '1'
        page.locator('#pauseBtn').click()
        assert page.get_by_text('Verschnaufpause').is_visible()
        page.locator('#resume').click()
        page.locator('#pauseBtn').click()
        page.locator('#backMenu').click()
        assert page.locator('#menuPanel').is_visible()
        assert page.locator('[data-tab="play"]').get_attribute('aria-current') == 'page'
        assert page.evaluate('document.scrollingElement.scrollHeight <= document.documentElement.clientHeight + 2')
        assert not errors, (label, errors)
        print(label,'menu/game/goal/pause/return OK')
        context.close()
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page.set_content(html)
    page.locator('[data-points="5"]').click()
    page.locator('#startBtn').click()
    page.evaluate('window.__pp.setPuck(260,635,0,900)')
    page.wait_for_timeout(180)
    assert page.evaluate('window.__pp.getState().puck.vy') < 0,'Mallet collision failed'
    page.evaluate('window.__pp.setPuck(260,60,0,-1100)')
    page.wait_for_timeout(200)
    assert page.evaluate('window.__pp.getState().score[0]') == 1,'Real goal failed'
    page.evaluate('window.__pp.setScore(4,0)')
    page.evaluate('window.__pp.goal(0)')
    assert page.get_by_text('DU HAST GEWONNEN!').is_visible()
    page.locator('#rematch').click()
    assert page.evaluate('window.__pp.getState().score') == [0,0]
    print('Puck collision/goal/win/rematch OK')
    # Features: 14 horizontal swipe cards, louder music control, three optional pickups and predictive Pro AI.
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(html)
    page.locator('[data-tab="arenas"]').click()
    assert page.locator('.arena').count() == 6
    assert page.locator('#arenaPageLabel').inner_text() == '1 / 3'
    page.locator('#arenaNext').click()
    assert page.locator('#arenaPageLabel').inner_text() == '2 / 3'
    page.locator('[data-theme="matrix"]').click()
    assert page.locator('[data-theme="matrix"]').get_attribute('aria-pressed') == 'true'
    assert page.evaluate('window.__pp.getState().soundtrack') == 'glitch'
    page.locator('#arenaDone').click()
    page.locator('[data-tab="options"]').click()
    page.locator('#musicVolume').evaluate("(el)=>{el.value='95';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    assert page.evaluate('window.__pp.getState().volume') == 95
    page.locator('#powerToggle').click()
    assert page.locator('#powerToggle').get_attribute('aria-pressed') == 'true'
    page.locator('[data-tab="play"]').click()
    page.locator('#startBtn').click()
    page.wait_for_timeout(50)
    assert page.evaluate('window.__pp.getState().powerups') is True
    page.evaluate("()=>{window.__pp.setLastTouch(0);window.__pp.setPuck(260,430,350,-450);window.__pp.spawnPowerup('boost',260,430)}")
    page.wait_for_timeout(100)
    state=page.evaluate('window.__pp.getState()')
    assert state['powerup'] is None, 'Turbo puck pickup failed'
    assert (state['puck']['vx']**2+state['puck']['vy']**2)**.5 > 760, 'Turbo not applied'
    page.evaluate("()=>{window.__pp.setLastTouch(0);window.__pp.setPuck(260,430,50,-600);window.__pp.spawnPowerup('shield',260,430)}")
    page.wait_for_timeout(80)
    assert page.evaluate('window.__pp.getState().shield[0]') > 0, 'Shield pickup failed'
    page.evaluate("()=>{window.__pp.setPuck(260,853,0,1450)}")
    page.wait_for_timeout(110)
    state=page.evaluate('window.__pp.getState()')
    assert state['score'][1] == 0, 'Shield failed to save player 1 goal'
    assert state['shield'][0] == 0, 'Shield did not consume its charge'
    page.evaluate("()=>{window.__pp.setLastTouch(1);window.__pp.setPuck(260,430,60,-400);window.__pp.spawnPowerup('magnet',260,430)}")
    page.wait_for_timeout(80)
    assert page.evaluate('window.__pp.getState().magnet[1]') > 0, 'Magnet pickup failed'
    page.locator('#pauseBtn').click()
    page.locator('#backMenu').click()
    page.locator('[data-tab="options"]').click()
    page.locator('#powerToggle').click()
    page.locator('[data-tab="play"]').click()
    page.locator('[data-ai="hard"]').click()
    page.locator('[data-tab="arenas"]').click()
    page.locator('#arenaNext').click()
    page.locator('[data-theme="realm"]').click()
    page.locator('#arenaDone').click()
    assert page.evaluate('window.__pp.getState().soundtrack') == 'epic'
    page.locator('#startBtn').click()
    page.evaluate('window.__pp.setPuck(145,565,760,-740)')
    page.wait_for_timeout(140)
    state=page.evaluate('window.__pp.getState()')
    assert 50 <= state['aiTarget']['x'] <= 470 and 50 <= state['aiTarget']['y'] < 400
    assert abs(state['far']['x']-260) > 1, 'Professional AI did not move toward the puck'
    assert not errors, errors
    print('14 themes/audio volume/Turbo/Shield/Magnet/Pro AI OK')
    context.close()
    # iPhone SE and compact Android: all native-like tabs stay on a fixed viewport.
    for viewport in [{'width':320,'height':568},{'width':375,'height':667},{'width':430,'height':932},{'width':915,'height':412}]:
        ctx=browser.new_context(viewport=viewport,is_mobile=True,has_touch=True)
        p=ctx.new_page()
        p.set_content(html)
        assert p.locator('#tabPlay').is_visible(), viewport
        assert p.locator('#startBtn').is_visible(), viewport
        assert p.evaluate('document.scrollingElement.scrollHeight <= document.documentElement.clientHeight + 2'), viewport
        for tab, expected in [('arenas','tabArenas'),('options','tabOptions'),('play','tabPlay')]:
            p.locator(f'[data-tab="{tab}"]').click()
            assert p.locator('#'+expected).is_visible(), (viewport,tab)
            assert p.evaluate('window.scrollY') == 0, (viewport,tab)
        p.locator('#startBtn').click()
        p.wait_for_timeout(100)
        assert p.evaluate("window.__pp.getState().paused") is False
        ctx.close()
    print('Compact phones + app navigation + non-scrollable game OK')
    browser.close()
