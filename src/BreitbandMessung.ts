import {
  CoreLogChannel,
  CoreLogger,
  DefaultLogger,
  LogLevel,
} from '@grandlinex/core';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';

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

const base_url = 'https://breitbandmessung.de';

export default class BreitbandMessung extends CoreLogChannel {
  path: string;

  headless: boolean;

  docker: boolean;

  constructor(conf: {
    path: string;
    headLess?: boolean;
    docker?: boolean;
    log?: CoreLogger;
  }) {
    super('messure', conf.log || new DefaultLogger(LogLevel.VERBOSE));
    this.path = conf.path;
    this.headless = conf.headLess ?? true;
    this.docker = conf.docker ?? true;
    this.debug(
      JSON.stringify({
        headless: this.headless,
        docker: this.docker,
        path: this.path,
      })
    );
  }

  private async click_button(
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
      this.error(`could not click element\nError: ${err}`);
      await page.screenshot({ path: `${this.path}/error-screenshot.png` });
      await browser.close();
      process.exit(1);
    }
  }

  private async getJsData(
    selector: string,
    page: Page
  ): Promise<string | null> {
    const raw = await page.$$(selector);
    const el = raw.pop();
    const props = await el?.getProperty<any>('innerText');
    const val = await props?.jsonValue();
    return val || null;
  }

  async prePare() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true });
    }
  }

  async run(): Promise<void> {
    try {
      const browser = await puppeteer.launch({
        // product: "chrome",
        // executablePath: "/usr/bin/chromium",
        headless: this.headless,
        args: this.docker
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : undefined,
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
        downloadPath: this.path,
      });

      try {
        // open website and wait till it is loaded
        await Promise.all([
          page.goto(`${base_url}/test`),
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);

        this.info('PREPARING SPEEDTEST');

        // click start test
        await this.click_button(browser, page, start_test_selector);

        // click accept policy
        await this.click_button(browser, page, accept_policy_selector);

        this.info('RUNNING SPEEDTEST');

        // wait for test to be done
        try {
          await page.waitForSelector(download_results_selector, {
            timeout: 300 * 10 ** 3,
            visible: true,
          });

          this.info('SPEEDTEST DONE');
        } catch (err) {
          this.log('could not find results for download');
          this.log(err);
          await browser.close();
          return;
        }

        // download results
        await this.click_button(browser, page, download_results_selector);

        this.debug(`saved results to ${this.path}`);

        // get measured speeds to show it in stdout
        const downloadSpeed = await this.getJsData(
          download_speed_selector,
          page
        );

        const uploadSpeed = await this.getJsData(upload_speed_selector, page);

        this.info(`RESULTS >>> D:[${downloadSpeed}] U:[${uploadSpeed}]`);

        await new Promise((r) => {
          setTimeout(r, 2000);
        });
        // exit browser
        await browser.close();

        // set rights for all in the download path
        // await fs.promises.chmod(PATH, '777');
      } catch (err) {
        this.error('fatal error');
        this.error(err);
        await browser.close();
        return;
      }
    } catch (error) {
      this.error('Error starting puppeteer');
      this.error(error);
    }
  }
}
