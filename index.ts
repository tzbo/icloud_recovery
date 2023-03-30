import { firefox, chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
    const browser = await chromium.launch({
        headless: false,
    });
    let storageState = {} as any;
    if (fs.existsSync('state.json')) {
        storageState = JSON.parse(fs.readFileSync('state.json', 'utf8'));
    }
    const context = await browser.newContext({
        storageState: storageState
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10 * 60 * 1000);

    while (true) {
        try {
            await page.goto('https://www.icloud.com.cn/recovery/');
            await page.getByRole('button', { name: 'Show more options for Restore Files' }).click();;
            await page.waitForSelector('.child-application');
            storageState = await context.storageState()
            fs.writeFileSync('state.json', JSON.stringify(storageState));
            console.log('find recovery dialog');

            let count = 0;
            while (!page.isClosed()) {
                try {
                    if (count++ > 38) {
                        break;
                    }

                    console.log('current:', count);
                    const recoveryFrame = page.frame({ url: /iclouddrivefilerecovery/ });
                    await Promise.race([
                        recoveryFrame.waitForSelector('.documents-list'),
                        recoveryFrame.waitForSelector('.alert-button-container>div'),
                        recoveryFrame.waitForSelector('.dr-loading-error-view')
                    ]);
                    if (await recoveryFrame.isVisible('.alert-button-container>div')) {
                        console.log('find failure dialog');
                        await recoveryFrame.locator('.alert-button-container>div').click();
                        await page.waitForTimeout(2000);
                    } else if (await recoveryFrame.isVisible('.dr-loading-error-view')) {
                        console.log('load failure');
                        break;
                    }

                    console.log('wait complete')
                    const documentList = await recoveryFrame.$('.documents-list');
                    const center = await documentList.boundingBox();
                    await page.mouse.move(center.x + center.width / 2, center.y + center.height / 2);

                    await page.waitForTimeout(500);
                    await page.mouse.click(center.x + center.width / 2, center.y + center.height / 2);
                    console.log('click first');

                    await page.waitForTimeout(500);
                    await page.mouse.wheel(0, 4500);
                    console.log('mouse wheel completed');

                    await page.waitForTimeout(2000);
                    await page.keyboard.down('Shift');
                    await page.mouse.click(center.x + center.width / 2, center.y + center.height / 2);
                    await page.keyboard.up('Shift');
                    console.log('click second');

                    await page.waitForTimeout(500);
                    await recoveryFrame.locator('.selection-actions-wrapper div:last-child').click();
                    console.log('begin to recovery');
                    await recoveryFrame.waitForSelector('.br-spinner-view');
                } catch (err) {
                    console.log(err);
                    await page.waitForTimeout(3000);
                }
            }
        } catch (err) {
            console.log(err);
            await page.waitForTimeout(3000);
        };
    }
})();