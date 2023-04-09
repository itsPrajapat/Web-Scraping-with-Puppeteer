// Import necessary libraries
const puppeteer = require("puppeteer");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// connect to database
const db = new sqlite3.Database("verge.db");


// helper function to get month index from month name
function getMonthIndex(month) {
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase().substr(0, 3));
  return monthIndex !== -1 ? monthIndex : undefined;
}

// helper function to extract date from input string
function getDate(str) {
  const date = str.match(/\d+/);
  return date ? date[0] : undefined;
}

// Converting the date into required format
function dateFormatConversion(input){
  // create a new date object with the current year
  const date = new Date(new Date().getFullYear(), getMonthIndex(input), parseInt(getDate(input)));
  // format the date as a string in the desired format and return it
  const output =  `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  return output
}

// Define constants
const DATE_FORMAT = "ddmmyyyy";

// Define scraper class
class VergeScraper {
  constructor() {
    // Initialize instance variables
    this.headlines = [];
    this.authors = [];
    this.dates = [];
    this.urls = [];
    this.id = 0;
  }

  async scrape() {
    // Launch browser and navigate to the verge website
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://www.theverge.com/");

    // Get article data

    const data = await page.evaluate(() => {
      const articles = document.querySelectorAll(
        ".duet--recirculation--list-breaker-compact ol li"
      );
      const dataList = [];

      articles.forEach((article) => {
        const headlineElement = article.querySelector("a h3");
        const urlElement = article.querySelector("a");
        const authorElement = article.querySelectorAll("p span")[0];
        const dateElement = article.querySelectorAll("p span")[1];

        const headline = headlineElement.innerHTML.trim();
        const url = urlElement.href.trim();
        const author = authorElement.innerHTML.trim();
        const date = dateElement.innerHTML.trim();

        dataList.push({ headline, url, author, date });
        // dataList.push(headline);
      });

      return dataList;
    });

    // Store article data in instance variables
    data.forEach((articleData) => {
      this.headlines.push(articleData.headline);
      this.authors.push(articleData.author);
      this.dates.push(articleData.date);
      this.urls.push(articleData.url);
    });

    // Close browser
    await browser.close();
  }

  async saveToCsv() {
    // Create CSV file with header
    const header = "id | URL | headline | author | date\n";
    const filename = `${DATE_FORMAT}_verge.csv`;
    await fs.promises.writeFile(filename, header);

    // Write article data to CSV file
    for (let i = 0; i < this.headlines.length; i++) {
      const id = ++this.id;
      const url = this.urls[i];
      const headline = this.headlines[i];
      const author = this.authors[i];
      // const date = this.dates[i];
      const date = dateFormatConversion(this.dates[i]);

      const line = `${id} | ${url} | "${headline}" | ${author} | ${date}\n`;
      await fs.promises.appendFile(filename, line);
    }
  }

  async saveToDatabase() {
    //create table in sql database if it does not exist
    db.run(
      `CREATE TABLE IF NOT EXISTS  articles (
        id INTEGER PRIMARY KEY,
        url TEXT,
        headline TEXT,
        author TEXT,
        date TEXT
      )`,
      (err) => {
        if (err) {
          console.log(err.message);
        } else {
          // Insert article data into database (de-duplicate by URL)
          const item_insert_command = `INSERT INTO articles (url, headline, author, date) VALUES (?, ?, ?, ?)`;
          for (let i = 0; i < this.headlines.length; i++) {
            const url = this.urls[i];
            const headline = this.headlines[i];
            const author = this.authors[i];
            const date = this.dates[i];
            db.run(item_insert_command, [url, headline, author, date]);
          }

          // Close database connection
          db.close();
        }
      }
    );
  }
}

// Define test cases
async function runTests() {
  const scraper = new VergeScraper();

  errorInCode();

  console.log("Scraping articles...");
  await scraper.scrape();

  console.log("Saving articles to CSV...");
  await scraper.saveToCsv();

  console.log("Saving articles to database...");
  await scraper.saveToDatabase();

  console.log("Verifying articles in CSV file...");
  const csvData = await fs.promises.readFile(`${DATE_FORMAT}_verge.csv`);
  const csvLines = csvData.toString().split("\n");

  if (csvLines[0].trim() !== "id | URL | headline | author | date") {
    console.error("CSV header does not match expected format");
    return;
  }

  for (let i = 1; i < csvLines.length - 1; i++) {
    const fields = csvLines[i]
      .trim()
      .split("|")
      .map((field) => field.trim());

    if (fields.length !== 5) {
      console.error(
        `CSV line ${i + 1} does not have expected number of fields`
      );
      continue;
    }

    const id = parseInt(fields[0]);
    const url = fields[1];
    const headline = fields[2];
    const author = fields[3];
    const date = fields[4];

    if (isNaN(id)) {
      console.error(`CSV line ${i + 1} has invalid id`);
    }

    if (!url.startsWith("http")) {
      console.error(`CSV line ${i + 1} has invalid URL`);
    }

    if (headline.length === 0) {
      console.error(`CSV line ${i + 1} has empty headline`);
    }

    if (author.length === 0) {
      console.error(`CSV line ${i + 1} has empty author`);
    }

    if (date.length === 0) {
      console.error(`CSV line ${i + 1} has empty date`);
    }
  }

  console.log("Verifying articles in database...");
  const db = new sqlite3.Database("verge.db");

  db.all("SELECT COUNT(*) AS count FROM articles", (err, rows) => {
    if (err) {
      console.error("Error querying database:", err);
      return;
    }

    const count = rows[0].count;

    if (count !== scraper.headlines.length) {
      console.error(
        `Database contains ${count} articles, expected ${scraper.headlines.length}`
      );
      return;
    }

    console.log("All tests passed!");
  });

  db.close();
}

runTests();

function errorInCode() {
  const dc = "\n\n******************************************\n\n";
  const message =
    "Table creation function is not direct process, it takes time ⌚⌚⌚ so use asynchronous (async ,await) in our case i have used callback so when the the table creation will be completed then only we will try to create itemes in it ✌️✌️✌️";
  console.log(dc, message, dc);
}
