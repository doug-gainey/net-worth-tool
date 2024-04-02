# Net Worth

This is a serverless tool for tracking personal net worth over time. I've used automated tools like Mint and Credit
Karma to track my net worth in the past, but they were more than I needed and didn't do exactly what I wanted.
After several times of losing my history using those tools, I resorted to tracking my data in spreadsheets. This tool is
just a natural progression of those spreadsheets.

## Technical Stack
- JavaScript
- IndexedDB
- Bootstrap
- Chart JS

## Usage
The tool makes use of IndexedDB for storage, so it can be run locally.

To get started:

- Navigate to index.html.
- Use the Add Entry button to add individual entries to the database.
- You can also use the Import Data button to import pre-existing data from a csv file.  Just make sure the csv file is in the format (date, assets, debts, notes):

  ```
  "01/01/2024","50000.00","10000.00",""
  "02/01/2024","49000.00","11000.00","I had car repairs this month. Ugh!"
  "03/01/2024","520000.00","9000.00","I scored a bonus at work!"
  ```

## IMPORTANT
The Net Worth tool stores your data using the browser's IndexedDB implementation.
However, be aware that IndexedDB is a client-side technology. **If you choose to clear site data ("Offline website data" in Firefox and "Cookies and other site data" in Chrome), you are deleting the Net Worth database.**
To safeguard against this, the tool provides an Export Data option that generates a csv backup of your data that can be re-imported at any time.
