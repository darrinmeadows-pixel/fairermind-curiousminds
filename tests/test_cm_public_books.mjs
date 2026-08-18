import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const booksLib = require("../js/cm-books.js");
const catalogue = require("../data/catalogue.json");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const booksIndex = fs.readFileSync(path.join(root, "books/index.html"), "utf8");
const moonPage = fs.readFileSync(
  path.join(root, "books/why-does-the-moon-change-shape/index.html"),
  "utf8"
);
const fishPage = fs.readFileSync(
  path.join(root, "books/how-do-fish-breathe-underwater/index.html"),
  "utf8"
);
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const qrHtml = fs.readFileSync(
  path.join(root, "q/5-10/fish-breathe-underwater/index.html"),
  "utf8"
);
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const eventsSrc = fs.readFileSync(path.join(root, "functions/lib/cm-events.js"), "utf8");
const adminAuthSrc = fs.readFileSync(
  path.join(root, "functions/lib/cm-admin-auth.js"),
  "utf8"
);

const MOON = "CM-Y02to05-STO-SCI-MOON";
const FISH = "CM-Y05to10-STO-SCI-BEACH";
const moonCoverRel = "assets/books/book-001-moon-cover.jpg";
const fishCoverRel = "assets/books/book-002-fish-cover.jpg";

function sha256(relPath) {
  return createHash("sha256")
    .update(fs.readFileSync(path.join(root, relPath)))
    .digest("hex");
}

assert.equal(catalogue.books[FISH].title, "How Do Fish Breathe Underwater?");
assert.equal(catalogue.books[FISH].id, FISH);
assert.equal(
  catalogue.books[FISH].retailers_by_market.GB[0].href,
  "https://www.amazon.co.uk/dp/B0HFFYSJPY"
);
assert.equal(
  catalogue.books[FISH].retailers_by_market.GB[1].href,
  "https://www.amazon.co.uk/dp/B0HFF176XT"
);
assert.equal(
  catalogue.qr_routes["5-10/fish-breathe-underwater"].permanent_path,
  "/q/5-10/fish-breathe-underwater"
);
assert.equal(catalogue.books[MOON].public_page, "/books/why-does-the-moon-change-shape/");
assert.equal(catalogue.books[FISH].public_page, "/books/how-do-fish-breathe-underwater/");
assert.deepEqual(catalogue.books[MOON].learning_resources, []);
assert.deepEqual(catalogue.books[FISH].learning_resources, []);
assert.equal(catalogue.books[MOON].cover_image, "/" + moonCoverRel);
assert.equal(catalogue.books[FISH].cover_image, "/" + fishCoverRel);
assert.equal(catalogue.books[MOON].cover_display, "square");
assert.equal(catalogue.books[FISH].cover_display, "square");

assert.equal(
  sha256(moonCoverRel),
  "781509972b5c5ba35bd099a3ed7218efda164da457665de2fbb81e9e3fb5a1c7"
);
assert.equal(
  sha256(fishCoverRel),
  "32dab1df92000c63482cbd45a69cf94989e836bd174173d63c864ca03ef338d0"
);

const stylesCss = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const coverCorpus = [
  indexHtml,
  booksIndex,
  moonPage,
  fishPage,
  qrHtml,
  stylesCss,
  JSON.stringify(catalogue)
].join("\n");
assert.equal(/book-cover--wrap/.test(coverCorpus), false);
assert.equal(/object-position/.test(stylesCss), false);
assert.equal(/CM-Y02to05-STO-SCI-MOON-COVER-KDP-FINAL/.test(coverCorpus), false);
assert.equal(/CM-Y05to10-STO-SCI-BEACH-COVER-HOW-DO-CLEAN-EDGE-V2/.test(coverCorpus), false);
assert.equal(
  fs.existsSync(
    path.join(root, "assets/books/CM-Y02to05-STO-SCI-MOON-COVER-KDP-FINAL-5045x2550-300PPI.png")
  ),
  false
);
assert.equal(
  fs.existsSync(
    path.join(root, "assets/books/CM-Y05to10-STO-SCI-BEACH-COVER-HOW-DO-CLEAN-EDGE-V2.jpg")
  ),
  false
);
assert.match(
  moonPage,
  /og:image" content="https:\/\/curiousminds.fairermind.com\/assets\/books\/book-001-moon-cover\.jpg"/
);
assert.match(
  moonPage,
  /"image": "https:\/\/curiousminds.fairermind.com\/assets\/books\/book-001-moon-cover\.jpg"/
);
assert.match(
  fishPage,
  /og:image" content="https:\/\/curiousminds.fairermind.com\/assets\/books\/book-002-fish-cover\.jpg"/
);
assert.match(
  fishPage,
  /"image": "https:\/\/curiousminds.fairermind.com\/assets\/books\/book-002-fish-cover\.jpg"/
);
assert.match(indexHtml, /src="assets\/books\/book-001-moon-cover\.jpg"/);
assert.match(indexHtml, /src="assets\/books\/book-002-fish-cover\.jpg"/);
assert.match(booksIndex, /src="\/assets\/books\/book-001-moon-cover\.jpg"/);
assert.match(booksIndex, /src="\/assets\/books\/book-002-fish-cover\.jpg"/);
assert.match(qrHtml, /src="\/assets\/books\/book-002-fish-cover\.jpg"/);

const coverRefRe =
  /(?:src="\/?|content="https:\/\/curiousminds\.fairermind\.com\/|"image": "https:\/\/curiousminds\.fairermind\.com\/|cover_image": "\/)(assets\/books\/[^"]+)/g;
const coverRefs = new Set();
for (const text of [indexHtml, booksIndex, moonPage, fishPage, qrHtml, JSON.stringify(catalogue)]) {
  coverRefRe.lastIndex = 0;
  let match;
  while ((match = coverRefRe.exec(text))) {
    coverRefs.add(match[1]);
  }
}
assert.deepEqual(
  [...coverRefs].sort(),
  ["assets/books/book-001-moon-cover.jpg", "assets/books/book-002-fish-cover.jpg"]
);
for (const rel of coverRefs) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
}

assert.match(booksIndex, /rel="canonical" href="https:\/\/curiousminds.fairermind.com\/books\/"/);
assert.match(
  moonPage,
  /rel="canonical" href="https:\/\/curiousminds.fairermind.com\/books\/why-does-the-moon-change-shape\/"/
);
assert.match(
  fishPage,
  /rel="canonical" href="https:\/\/curiousminds.fairermind.com\/books\/how-do-fish-breathe-underwater\/"/
);
assert.match(moonPage, /application\/ld\+json/);
assert.match(fishPage, /application\/ld\+json/);
assert.match(moonPage, /og:title/);
assert.match(fishPage, /og:image/);
assert.equal(/noindex/i.test(booksIndex + moonPage + fishPage), false);
assert.match(qrHtml, /noindex, follow/);
assert.match(qrHtml, /href="\/books\/"/);
assert.equal(/#first-book/.test(qrHtml), false);

assert.match(moonPage, /Front cover of Why Does the Moon Change Shape/);
assert.match(fishPage, /Front cover of How Do Fish Breathe Underwater\?/);
assert.match(booksIndex, /alt="Front cover of Why Does the Moon Change Shape/);
assert.match(booksIndex, /alt="Front cover of How Do Fish Breathe Underwater\?/);
assert.equal(/alt=""/g.test(moonPage.match(/book-cover[\s\S]*?>/)[0] || ""), false);

assert.match(moonPage, /data-track-page-view="true"/);
assert.match(moonPage, /data-track-source="book"/);
assert.match(fishPage, /data-track-page-view="true"/);
assert.match(fishPage, /data-track-source="book"/);
assert.match(
  moonPage,
  /href="\/go\/amazon\/CM-Y02to05-STO-SCI-MOON\?market=GB&amp;format=paperback&amp;src=book"/
);
assert.equal(/CM-Y02to05-STO-SCI-MOON[^"]*format=kindle/.test(moonPage), false);
assert.match(
  fishPage,
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=paperback&amp;src=book"/
);
assert.match(
  fishPage,
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=kindle&amp;src=book"/
);
assert.match(
  qrHtml,
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=kindle&amp;src=qr"/
);
assert.match(indexHtml, /href="\/books\/"/);
assert.match(indexHtml, /How Do Fish Breathe Underwater\?/);
assert.equal(/First book/.test(indexHtml), false);

function relatedBlock(html) {
  const match = html.match(
    /<section class="section section--alt" aria-labelledby="related-heading">([\s\S]*?)<\/section>/
  );
  return match ? match[1] : "";
}

const moonRelated = relatedBlock(moonPage);
const fishRelated = relatedBlock(fishPage);
assert.match(
  moonRelated,
  /<a class="related-book__title" href="\/books\/how-do-fish-breathe-underwater\/">How Do Fish Breathe Underwater\?<\/a>/
);
assert.match(moonRelated, /<p class="related-book__age">Ages 5–10<\/p>/);
assert.equal(/— ages/i.test(moonRelated), false);
assert.match(
  fishRelated,
  /<a class="related-book__title" href="\/books\/why-does-the-moon-change-shape\/">Why Does the Moon Change Shape\?: Understanding Moon Phases<\/a>/
);
assert.match(fishRelated, /<p class="related-book__age">Ages 2–5<\/p>/);
assert.equal(/— ages/i.test(fishRelated), false);
assert.match(stylesCss, /\.related-book__age[\s\S]*?white-space:\s*nowrap/);
assert.equal(/white-space:\s*nowrap/.test(stylesCss.match(/\.related-book__title[\s\S]*?}/)[0]), false);

assert.match(sitemap, /https:\/\/curiousminds.fairermind.com\/</);
assert.match(sitemap, /https:\/\/curiousminds.fairermind.com\/books\/</);
assert.match(sitemap, /why-does-the-moon-change-shape/);
assert.match(sitemap, /how-do-fish-breathe-underwater/);
assert.equal(/\/q\//.test(sitemap), false);
assert.equal(/\/admin\//.test(sitemap), false);
assert.equal(/\/api\//.test(sitemap), false);
assert.equal(/\/go\//.test(sitemap), false);
assert.match(robots, /Sitemap: https:\/\/curiousminds.fairermind.com\/sitemap.xml/);
assert.match(robots, /Disallow: \/q\//);

assert.match(booksIndex, /id="book-search"/);
assert.match(booksIndex, /hidden/);
assert.match(booksIndex, /data-min-books="6"/);
assert.equal((booksIndex.match(/data-public-book/g) || []).length, 2);

function listingCards(html) {
  return [...html.matchAll(/<article\s+class="book-card"[\s\S]*?<\/article>/g)].map(function (match) {
    return match[0];
  });
}

function assertSharedListingCard(card) {
  assert.match(card, /class="book-card__link"/);
  assert.match(card, /class="book-cover"/);
  assert.match(card, /class="book-card__title"/);
  assert.match(card, /class="book-card__description"/);
  assert.match(card, /class="book-card__cta"/);
}

assert.match(indexHtml, /class="books-grid"/);
assert.match(booksIndex, /class="books-grid"/);
assert.equal(/books-home-grid/.test(indexHtml + booksIndex + stylesCss), false);
assert.equal(/class="book-teaser"/.test(indexHtml), false);

const homeCards = listingCards(indexHtml);
const bookCards = listingCards(booksIndex);
assert.equal(homeCards.length, 2);
assert.equal(bookCards.length, 2);
homeCards.forEach(assertSharedListingCard);
bookCards.forEach(assertSharedListingCard);
bookCards.forEach(function (card) {
  assert.equal((card.match(/<a /g) || []).length, 1);
  assert.match(card, /<a class="book-card__link" href="\/books\/[^"]+\/">/);
  assert.match(card, /<\/a>\s*<\/article>/);
});
assert.match(
  homeCards[0],
  /href="\/go\/amazon\/CM-Y02to05-STO-SCI-MOON\?market=GB&amp;format=paperback&amp;src=home"/
);
assert.match(
  homeCards[1],
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=kindle&amp;src=home"/
);
assert.match(stylesCss, /\.book-card__link:link,\s*\n\.book-card__link:visited/);
assert.match(stylesCss, /\.book-card__link:link \.book-card__title,\s*\n\.book-card__link:visited \.book-card__title/);
assert.match(stylesCss, /\.book-card__link:link \.book-card__description,\s*\n\.book-card__link:visited \.book-card__description/);
assert.match(stylesCss, /\.book-card__link:link \.book-card__cta,\s*\n\.book-card__link:visited \.book-card__cta/);
assert.match(
  stylesCss,
  /\.book-card__link,\s*\n\.book-card__link:link,\s*\n\.book-card__link:visited \{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;/
);
assert.match(stylesCss, /\.book-card \{[\s\S]*?height:\s*100%;/);
assert.match(stylesCss, /\.books-grid \{[\s\S]*?align-items:\s*stretch;/);
assert.match(stylesCss, /\.book-card__cta \{[\s\S]*?margin-top:\s*auto;/);
assert.match(stylesCss, /\.book-cover \{[\s\S]*?aspect-ratio:\s*1;/);
assert.match(stylesCss, /\.book-cover img \{[\s\S]*?object-fit:\s*contain;/);
const mobileBookCss = stylesCss.split("@media (max-width: 47.99rem)")[1];
assert.match(moonPage, /class="book-teaser"/);
assert.match(fishPage, /class="book-teaser"/);
assert.match(
  mobileBookCss,
  /\.book-teaser \{[\s\S]*?padding:\s*var\(--space-md\);[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/
);
assert.match(mobileBookCss, /\.book-teaser__content,\s*\n\s*\.book-teaser__content > \*,/);
assert.match(mobileBookCss, /min-width:\s*0;/);
assert.match(mobileBookCss, /\.book-teaser \.book-purchase \.btn,\s*\n\s*\.book-teaser \.hero__actions \.btn \{[\s\S]*?width:\s*100%;/);
assert.equal(/margin-left:\s*-/.test(mobileBookCss.split("}")[0] || ""), false);
assert.equal(/Explore More/.test(moonPage + fishPage), false);
assert.equal(/coming soon/i.test(moonPage + fishPage + booksIndex), false);

assert.equal(booksLib.MIN_BOOKS_FOR_SEARCH, 6);
assert.equal(booksLib.shouldRevealBookSearch(2), false);
assert.equal(booksLib.shouldRevealBookSearch(5), false);
assert.equal(booksLib.shouldRevealBookSearch(6), true);

const moonBook = {
  title: catalogue.books[MOON].title,
  description: "gentle family story Moon remains round",
  age_label: "Ages 2–5",
  age_range: "2–5",
  topics: catalogue.books[MOON].topics
};
const fishBook = {
  title: catalogue.books[FISH].title,
  description: "rock pools gills oxygen",
  age_label: "Ages 5–10",
  age_range: "5–10",
  topics: catalogue.books[FISH].topics
};
assert.equal(booksLib.bookMatchesQuery(moonBook, "moon 2–5"), true);
assert.equal(booksLib.bookMatchesQuery(fishBook, "gills"), true);
assert.equal(booksLib.bookMatchesQuery(moonBook, "gills"), false);
assert.equal(booksLib.bookMatchesQuery(fishBook, "zzzz-no-match"), false);

function fakeCards(labels) {
  return labels.map(function (label) {
    return {
      hidden: false,
      text: label,
      getAttribute: function () {
        return label;
      }
    };
  });
}

const twoCards = fakeCards(["moon ages 2-5", "fish gills ages 5-10"]);
const twoRoot = {
  querySelector: function (sel) {
    if (sel === "#book-search") {
      return {
        hidden: true,
        setAttribute: function () {},
        removeAttribute: function () {},
        querySelector: function () {
          return null;
        }
      };
    }
    return null;
  },
  querySelectorAll: function () {
    return twoCards;
  }
};
assert.equal(booksLib.initBookSearch(twoRoot).revealed, false);

const sixLabels = ["one", "two", "three", "four", "five", "six gills"];
const sixCards = fakeCards(sixLabels);
let sixHidden = true;
const sixSearch = {
  hidden: true,
  setAttribute: function () {
    sixHidden = true;
  },
  removeAttribute: function () {
    sixHidden = false;
  },
  querySelector: function (sel) {
    if (sel === "#book-search-input" || sel === "#book-search-status") return null;
    return null;
  }
};
const sixRoot = {
  querySelector: function (sel) {
    return sel === "#book-search" ? sixSearch : null;
  },
  querySelectorAll: function () {
    return sixCards;
  }
};
assert.equal(booksLib.initBookSearch(sixRoot).revealed, true);
assert.equal(sixHidden, false);
assert.equal(sixSearch.hidden, false);

const status = { textContent: "" };
assert.equal(booksLib.applyBookSearch(sixCards, "gills", status), 1);
assert.equal(sixCards[5].hidden, false);
assert.equal(sixCards[0].hidden, true);
assert.equal(booksLib.applyBookSearch(sixCards, "no-such-book", status), 0);
assert.equal(status.textContent, "No books match that search.");

assert.deepEqual(booksLib.validLearningResources([]), []);
assert.equal(booksLib.learningResourcesHTML([]), "");
assert.equal(booksLib.learningResourcesHTML(null), "");
const populated = booksLib.learningResourcesHTML([
  {
    title: "Talk about rock pools",
    audience: "families",
    type: "discussion",
    url: "/resources/rock-pools/"
  }
]);
assert.match(populated, /Explore More/);
assert.match(populated, /For grown-ups and educators/);
assert.match(populated, /Talk about rock pools/);
assert.equal(
  booksLib.validLearningResources([
    { title: "Bad", audience: "families", type: "discussion", url: "https://example.com" }
  ]).length,
  0
);

const section = { hidden: false, innerHTML: "keep", setAttribute: function () {} };
assert.equal(booksLib.renderLearningResources(section, []), false);
assert.equal(section.hidden, true);
assert.equal(section.innerHTML, "");
assert.equal(
  booksLib.renderLearningResources(section, [
    {
      title: "Talk about rock pools",
      audience: "families",
      type: "discussion",
      url: "/resources/rock-pools/"
    }
  ]),
  true
);
assert.equal(section.hidden, false);
assert.match(section.innerHTML, /Explore More/);

assert.match(eventsSrc, /writeAnalyticsEvent/);
assert.match(adminAuthSrc, /__Host-cm_admin_session/);
assert.equal(/Why Can Fish Breathe Underwater/.test(booksIndex + moonPage + fishPage + indexHtml), false);

console.log("cm-public-books tests passed");
