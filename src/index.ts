import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// config
const { START_HEADLESS, EXPORT_PATH } = process.env;

const HEADLESS = START_HEADLESS ? START_HEADLESS === 'true' : true;
const PATH = EXPORT_PATH || path.join(__dirname, '..', 'export');
// base url
const base_url = 'https://breitbandmessung.de';

// selectors
const start_test_selector = '#root > div > div > div > div > div > button';
const accept_policy_selector =
  '#root > div > div.fade.modal-md.modal.show > div > div > div.justify-content-between.modal-footer > button:nth-child(2)';
const download_results_selector =
  '#root > div > div > div > div > div.messung-options.col.col-12.text-md-right > button.px-0.px-sm-4.btn.btn-link';
const download_speed_selector =
  '#root > div > div > div > div > div:nth-child(1) > div > div > div:nth-child(2) > div > div.progressIndicatorSingle > div.progress-info > div.fromto > span';
const upload_speed_selector =
  '#root > div > div > div > div > div:nth-child(1) > div > div > div.col.col-12.col-md-12.col-xl-4 > div > div.progressIndicatorSingle > div.progress-info > div.fromto > span';

// misc functions
async function click_button(
  browser: Browser,
  page: Page,
  selector: string,
  timeout = 30,
  visible = false
) {
  try {
    await page.waitForSelector(selector, {
      timeout: timeout * 10 ** 3,
      visible,
    });
    await page.click(selector);
  } catch (err) {
    console.log(`could not click element\nError: ${err}`);
    await page.screenshot({ path: `${PATH}/error-screenshot.png` });
    await browser.close();
    process.exit(1);
  }
}

/**
 * Extract json data from page with the given selector
 * @param selector
 */
async function getJsData(selector: string, page: Page): Promise<string | null> {
  const raw = await page.$$(selector);
  const el = raw.pop();
  const props = await el?.getProperty<any>('innerText');
  const val = await props?.jsonValue();
  return val || null;
}

async function run(): Promise<any | null> {
  try {
    const browser = await puppeteer.launch({
      // product: "chrome",
      // executablePath: "/usr/bin/chromium",
      headless: HEADLESS,
      /** Don't use --no-sandbox! Don't use as Root.
       *
       * args: ['--no-sandbox', '--disable-setuid-sandbox'],
       */
    });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(base_url, []);
    const page = await browser.newPage();
    await page.setViewport({
      width: 2024,
      height: 2024,
      deviceScaleFactor: 1,
    });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: PATH,
    });

    try {
      // open website and wait till it is loaded
      await Promise.all([
        page.goto(`${base_url}/test`),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);

      console.log('PREPARING SPEEDTEST');

      // click start test
      await click_button(browser, page, start_test_selector);

      // click accept policy
      await click_button(browser, page, accept_policy_selector);

      console.log('RUNNING SPEEDTEST');

      // wait for test to be done
      try {
        await page.waitForSelector(download_results_selector, {
          timeout: 300 * 10 ** 3,
          visible: true,
        });

        console.log('SPEEDTEST DONE');
      } catch (err) {
        console.log('could not find results for download');
        console.log(err);
        await browser.close();
        return;
      }

      // download results
      await click_button(browser, page, download_results_selector);

      console.log(`saved results to ${PATH}`);

      // get measured speeds to show it in stdout
      const downloadSpeed = await getJsData(download_speed_selector, page);

      const uploadSpeed = await getJsData(upload_speed_selector, page);

      console.log(`RESULTS >>> \nD:[${downloadSpeed}]\nU:[${uploadSpeed}]`);

      // exit browser
      await browser.close();

      // set rights for all in the download path
      // await fs.promises.chmod(PATH, '777');
    } catch (err) {
      console.log('fatal error');
      console.log(err);
      await browser.close();
      return;
    }
  } catch (error) {
    console.log('Error starting puppeteer');
    console.log(error);
  }
}

if (!fs.existsSync(PATH)) {
  fs.mkdirSync(PATH, { recursive: true });
}
run();
