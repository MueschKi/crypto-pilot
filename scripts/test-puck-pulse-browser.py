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
        assert page.locator('.arena').count() == 14
        page.locator('[data-mode="local"]').click()
        page.locator('[data-theme="lava"]').click()
        page.locator('#startBtn').click()
        page.wait_for_timeout(120)
        state = page.evaluate('window.__pp.getState()')
        assert state['page'] == 'game' and state['mode'] == 'local' and state['theme'] == 'lava', state
        page.evaluate('window.__pp.goal(0)')
        assert page.locator('#nearScore').inner_text() == '1'
        page.locator('#pauseBtn').click()
        assert page.get_by_text('Verschnaufpause').is_visible()
        page.locator('#resume').click()
        page.locator('#pauseBtn').click()
        page.locator('#backMenu').click()
        assert page.locator('#menuPanel').is_visible()
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
    assert page.locator('.arena').count() == 14
    page.locator('[data-theme="matrix"]').click()
    assert page.locator('[data-theme="matrix"]').get_attribute('aria-pressed') == 'true'
    assert page.evaluate('window.__pp.getState().soundtrack') == 'glitch'
    page.locator('#musicVolume').evaluate("(el)=>{el.value='95';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    assert page.evaluate('window.__pp.getState().volume') == 95
    page.locator('#powerToggle').click()
    assert page.locator('#powerToggle').get_attribute('aria-pressed') == 'true'
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
    page.locator('#powerToggle').click()
    page.locator('[data-ai="hard"]').click()
    page.locator('[data-theme="realm"]').click()
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
    browser.close()
