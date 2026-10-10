import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tools/level-generator/tests/browser',timeout:120000,workers:1,
  use:{baseURL:'http://127.0.0.1:3100',headless:true,viewport:{width:1280,height:720},launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:`npm run dev -- --port 3100 --no-hot --no-live-reload --env testhooks${process.env.LEVEL_TEST_HEADLESS ? ' --env headless' : ''}${process.env.LEVEL_TEST_CAMPAIGN ? ` --env campaign=${process.env.LEVEL_TEST_CAMPAIGN}` : ''}`,url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:process.env.LEVEL_TEST_CAMPAIGN?600000:120000},
});
