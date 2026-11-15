from pathlib import Path
from playwright.sync_api import sync_playwright

game_url=(Path(__file__).resolve().parents[1]/"docs"/"eieralarm"/"index.html").as_uri()
with sync_playwright() as p:
    browser=p.chromium.launch()
    landscape=browser.new_page(viewport={"width":844,"height":390},device_scale_factor=2,has_touch=True,is_mobile=True)
    errors=[]
    landscape.on("pageerror",lambda error: errors.append(str(error)))
    landscape.goto(game_url)
    assert not landscape.locator("#rotate").is_visible(), "Landscape must show game"
    wolf=landscape.locator("#wolf")
    first=wolf.get_attribute("transform")
    assert "scale(" in first and ".68" in first, first
    landscape.locator('[data-lane="tr"]').click()
    upper_right=wolf.get_attribute("transform")
    assert "574 325" in upper_right and "-.68" in upper_right, upper_right
    landscape.locator('[data-lane="bl"]').click()
    lower_left=wolf.get_attribute("transform")
    assert "506 356" in lower_left and ".68" in lower_left, lower_left
    assert first!=upper_right!=lower_left, "Wolf must change position"
    landscape.locator('[data-action="classic"]').click()
    assert landscape.evaluate("game.status")== "running"
    landscape.evaluate("game.elapsed=6000; game.spawnClock=0; game.tick(25); draw()")
    assert landscape.locator("#hare").get_attribute("opacity")=="1", "Hare should pop up"
    landscape.evaluate("game.elapsed=9000; game.spawnClock=0; game.tick(25); draw()")
    assert landscape.locator("#hare").get_attribute("opacity")=="0", "Hare should disappear"
    assert landscape.locator('#artWolf').count()==1, 'New wolf figure missing'
    assert landscape.locator('#rabbitBell').count()==1, 'Bell-carrying rabbit missing'
    for lane in ['tl','tr','bl','br']:
        assert landscape.locator('#hen-'+lane).count()==1, 'Hen '+lane+' missing'
        landscape.locator('[data-lane="'+lane+'"]').click()
        position=landscape.evaluate('''() => {
          const p = new DOMPoint(0,0).matrixTransform(document.getElementById('artBasket').getCTM());
          const t = lanes[game.lane].end;
          return {distance:Math.hypot(p.x-t[0], p.y-t[1]),x:p.x,y:p.y,target:t};
        }''')
        assert position['distance'] < 3.1, (lane,position)
    assert not errors, errors
    portrait=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=3,has_touch=True,is_mobile=True)
    portrait.goto(game_url)
    assert portrait.locator("#rotate").is_visible(), "Portrait must request rotation"
    assert portrait.locator("#handheld").count()==1
    browser.close()
print("PASS Chromium: moving wolf, rabbit, landscape controls, portrait gate, zero JS errors")
