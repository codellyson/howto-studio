// <project>/takes.cjs: the app-specific half of the pipeline. One function per guide, one t.say per script line.
const APP = 'http://localhost:3000';

module.exports = {
  // Non-GET requests matching these are aborted, and cut.py refuses the take if any were tried.
  blockWrites: [/^https:\/\/api\.example\.com\//],
  // Aborted without failing the take: background noise such as analytics.
  ignoreBlocked: [/\/analytics\//, /\/cdn-cgi\//],
  // Optional. Hide development-only controls.
  css: '#dev-toolbar{display:none!important}',

  guides: {
    async 'change-your-name'(t) {
      const { page: p, say, offCamera, click, button, visit, clickLinkToNewTab, waitForImages, afterTake, sleep } = t;
      const name = `Sample ${Date.now() % 10000}`;

      await offCamera(async () => {
        await visit(`${APP}/settings`, () => !!document.querySelector('form'));
        await waitForImages();
        await sleep(1500);
      });
      afterTake(async () => {
        await visit(`${APP}/settings`);
        await p.getByLabel('Name').fill('Original name');
        await button('Save').click();
      });

      await say('L01', async () => {
        await sleep(1200);
        await click(p.getByLabel('Name'));
      });
      await say('L02', async () => {
        await p.keyboard.press('Meta+A');
        await p.keyboard.type(name, { delay: 70 });
      });
      await say('L03', async () => {
        await click(button('Save'));
        await p.getByText('Saved').first().waitFor({ timeout: 30000 });
      });

      // The ending: the result as the other side sees it.
      let url;
      await say('L04', async () => {
        await sleep(1000);
        url = await clickLinkToNewTab(p.getByRole('link', { name: 'View public profile' }));
      });
      await offCamera(() => visit(url, new Function(`return document.body.innerText.includes(${JSON.stringify(name)})`)));
      await say('L05');
    },
  },
};
