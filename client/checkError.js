import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
    console.error(error.stack);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173/app/clerk/dashboard', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Navigation ended:', e.message);
  }

  await browser.close();
})();
