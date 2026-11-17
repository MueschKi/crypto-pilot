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
        assert page.locator('.arena').count() == 6
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
    browser.close()
