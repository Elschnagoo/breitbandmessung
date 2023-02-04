import * as path from 'path';
import NodeCron from 'node-cron';
import * as process from 'process';
import BreitbandMessung from './BreitbandMessung';
// config

const { START_HEADLESS, EXPORT_PATH, IS_DOCKER, CRON } = process.env;
console.log(process.env);
const HEADLESS = START_HEADLESS ? START_HEADLESS === 'true' : true;
const isDocker = IS_DOCKER === 'true';

const PATH = EXPORT_PATH || path.join(__dirname, '..', 'export');

const messure = new BreitbandMessung({
  path: PATH,
  headLess: HEADLESS,
  docker: isDocker,
});

if (CRON) {
  messure.log(`Mode: Cron -> ${CRON}`);
  NodeCron.schedule(CRON, () => messure.run());
} else {
  messure.log(`Mode: Single`);
  messure.run();
}
