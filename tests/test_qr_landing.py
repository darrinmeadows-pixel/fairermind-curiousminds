#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QR landing route checks for the Curious Minds static site."""
from __future__ import print_function

import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(ROOT)


def read(path):
    with open(os.path.join(ROOT, path), "r") as fh:
        return fh.read()


def load_json(path):
    with open(os.path.join(ROOT, path), "r") as fh:
        return json.load(fh)


html = read("q/5-10/fish-breathe-underwater/index.html")
catalogue = load_json("data/catalogue.json")
locale = load_json("data/locale.json")
i18n = load_json("data/i18n/en-GB.json")
book = catalogue["books"]["CM-Y05to10-STO-SCI-BEACH"]
route = catalogue["qr_routes"]["5-10/fish-breathe-underwater"]

assert os.path.isdir(os.path.join(ROOT, "q", "5-10", "fish-breathe-underwater"))
assert not os.path.exists(os.path.join(ROOT, "q", "fish-breathe-underwater", "index.html"))
assert route["permanent_path"] == "/q/5-10/fish-breathe-underwater"
assert route["age_band"] == "5-10"
assert route["book_id"] == "CM-Y05to10-STO-SCI-BEACH"
assert book["age_band"] == "5-10"
assert "html lang=\"en-GB\"" in html
assert "noindex, follow" in html
assert "Why Can Fish Breathe Underwater?" in html
assert "ages 5–10 edition" in html
assert "Ages 5–10" in html
assert "Science and nature" in html
assert "rock pools" in html
assert "gills" in html
assert "Skip to content" in html
assert 'href="/"' in html
assert 'href="/#about"' in html
assert 'href="mailto:hello@fairermind.com"' in html
assert "cm-locale.js" in html
assert "Country or region" in html
assert 'name="country"' in html
assert 'action="/q/5-10/fish-breathe-underwater/"' in html
assert "q/fish-breathe-underwater\"" not in html.replace("5-10/fish-breathe-underwater", "")
assert "source=book-qr" not in html

noscript_html = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
assert "Why Can Fish Breathe Underwater?" in noscript_html
assert "ages 5–10 edition" in noscript_html
assert "Explore Curious Minds" in noscript_html

for forbidden in [
    "Coming soon",
    "More Curious Minds books for ages 5–10",
    "Similar available science books",
    "Similar available nature books",
    "Teacher notes",
    "Guidance for parents and carers",
    "Where to find this book",
    "affiliate",
    "Buy now",
    "Amazon",
    "bit.ly",
    "tinyurl",
]:
    assert forbidden.lower() not in html.lower(), "unexpected content: %s" % forbidden

assert book["cover_image"] is None
assert book["teacher_notes"] == []
assert book["parent_carer_guidance"] == []
assert book["same_age_books"] == []
assert book["similar_science_books"] == []
assert book["similar_nature_books"] == []
assert book["retailers_by_market"] == {}
assert book["affiliate_links_by_market"] == {}
assert book["affiliate_authorised"] is False
assert i18n["language"] == "en-GB"
assert "ages 5–10 edition" in i18n["qr"]["welcome"]
assert locale["default_language"] == "en-GB"
assert locale["default_market"] == "INTL"

complete = [item["code"] for item in locale["languages"] if item.get("complete")]
assert complete == ["en-GB"]
assert "id=\"language-select\"" not in html
assert "CuriousMindsBooks" not in html
assert "FINAL-BOOK" not in html

js = read("js/cm-qr-landing.js")
locale_js = read("js/cm-locale.js")
function_js = read("functions/api/visitor-context.js")
headers = read("_headers")
routes = load_json("_routes.json")

assert "/cdn-cgi/trace" not in js
assert "/cdn-cgi/trace" not in locale_js
assert "/cdn-cgi/trace" not in function_js
assert "parseTrace" not in js
assert "/api/visitor-context" in js
assert "countryFromVisitorContextText" in locale_js
assert "request.cf.country" in function_js
assert "console.log" not in function_js
assert "Cache-Control: private, no-store" in headers
assert routes["include"] == ["/api/visitor-context"]
assert os.path.isfile(os.path.join(ROOT, "functions", "api", "visitor-context.js"))
assert not os.path.exists(os.path.join(ROOT, "functions", "lib", "country.js"))

# The visual page must still render from static files when the Function is absent.
assert 'id="country-select"' in html
assert "Use automatic region" in html
assert 'id="qr-landing"' in html

try:
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    page = urlopen(
        Request("http://127.0.0.1:8081/q/5-10/fish-breathe-underwater/"),
        timeout=2
    )
    body = page.read().decode("utf-8")
    assert page.getcode() == 200
    assert "Why Can Fish Breathe Underwater?" in body
    assert 'id="country-select"' in body
    assert "ages 5–10 edition" in body
    try:
        urlopen(Request("http://127.0.0.1:8081/api/visitor-context"), timeout=2)
        raise AssertionError("static localhost must not execute the Pages Function")
    except HTTPError as err:
        assert err.code == 404
except URLError:
    pass

print("qr landing tests passed")
