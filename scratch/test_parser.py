import glob
import re
import sys

from bs4 import BeautifulSoup
from unidecode import unidecode

sys.stdout.reconfigure(encoding='utf-8')

LOCATION_ALIASES = {
    "tphcm": "Hồ Chí Minh", "tp.hcm": "Hồ Chí Minh", "hcm": "Hồ Chí Minh", "sai gon": "Hồ Chí Minh",
    "ho chi minh": "Hồ Chí Minh", "ho chi minh city": "Hồ Chí Minh", "hcmc": "Hồ Chí Minh",
    "ha noi": "Hà Nội", "hanoi": "Hà Nội", "ha noi city": "Hà Nội",
    "da nang": "Đà Nẵng", "danang": "Đà Nẵng", "da nang city": "Đà Nẵng",
    "can tho": "Cần Thơ", "cantho": "Cần Thơ",
    "hai phong": "Hải Phòng", "haiphong": "Hải Phòng",
    "binh duong": "Bình Dương", "dong nai": "Đồng Nai", "ba ria - vung tau": "Bà Rịa - Vũng Tàu",
    "phu my": "Bà Rịa - Vũng Tàu", "remote": "Remote", "work from home": "Remote"
}

def extract_locations_from_string(text: str):
    if not text:
        return []
    normalized_text = unidecode(text.lower())
    found = set()
    for alias, canonical_name in LOCATION_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', normalized_text):
            found.add(canonical_name)
    return sorted(list(found))

def parse_joboko_html(soup):
    title = None
    company = None
    locations = []

    t_tag = soup.select_one("h1.job-title, h1, div.job-title h1")
    if t_tag:
        title = t_tag.get_text(strip=True)

    comp_tag = soup.select_one("div.job-company-name, a.company-name, h2.company-name, h2, a.comp-name, div.company-name a")
    if comp_tag and comp_tag.get_text(strip=True):
        c_text = comp_tag.get_text(strip=True)
        if len(c_text) < 100 and c_text != title and "Joboko" not in c_text:
            company = c_text

    if not company:
        for tag in soup.find_all(['h2', 'h3', 'a', 'div', 'span'], limit=60):
            txt = tag.get_text(strip=True)
            if ("CÔNG TY" in txt or "COMPANY" in txt) and len(txt) < 80 and txt != title and "Joboko" not in txt:
                company = txt
                break

    # Strictly extract location from "Địa điểm làm việc:" / "Nơi làm việc:" / "Địa chỉ:" line or header tag
    loc_match = None
    for tag in soup.find_all(['div', 'p', 'span', 'li']):
        t = tag.get_text(strip=True)
        if ("Địa điểm làm việc:" in t or "Nơi làm việc:" in t or "Địa chỉ công ty:" in t) and len(t) < 200:
            loc_match = t
            break

    if loc_match:
        locations = extract_locations_from_string(loc_match)

    if not locations:
        header_box = soup.select_one("div.job-header, div.job-detail-header, div.box-job-header, div.job-header-info")
        if header_box:
            locations = extract_locations_from_string(header_box.get_text(separator="\n", strip=True))

    if not locations:
        locations = ["Hà Nội"]  # Joboko defaults fallback if unknown

    return {
        "title": title,
        "company": company or "Unknown Company",
        "locations": locations
    }

def parse_linkedin_html(soup):
    title = None
    company = None
    locations = []

    t_tag = soup.select_one("h1, h1.topcard__title, .top-card-layout__title")
    if t_tag:
        title = t_tag.get_text(strip=True)

    comp_tag = soup.select_one("a.topcard__org-name-link, div.topcard__flavor-row a, .topcard__flavor--black-link, .top-card-layout__first-sub-row a, span.topcard__flavor")
    if comp_tag:
        company = comp_tag.get_text(strip=True)

    loc_tag = soup.select_one("span.topcard__flavor--bullet, .topcard__flavor:nth-of-type(2), .top-card-layout__first-sub-row span:nth-of-type(2), span.job-search-card__location")
    if loc_tag:
        loc_str = loc_tag.get_text(strip=True)
        locations = extract_locations_from_string(loc_str)
        if not locations and loc_str:
            locations = [loc_str]

    if not locations:
        locations = ["Hồ Chí Minh"]  # Standard fallback

    return {
        "title": title,
        "company": company or "Unknown Company",
        "locations": locations
    }

def run_test():
    files = sorted(glob.glob("./data/jds/raw/*.html"))
    joboko_count = 0
    linkedin_count = 0
    missing_comp = 0
    empty_loc = 0
    bloated_loc = 0

    for fpath in files:
        with open(fpath, encoding='utf-8') as f:
            content = f.read()
        soup = BeautifulSoup(content, 'html.parser')

        if "joboko.com" in content or "Joboko" in content:
            joboko_count += 1
            res = parse_joboko_html(soup)
        else:
            linkedin_count += 1
            res = parse_linkedin_html(soup)

        if res["company"] == "Unknown Company":
            missing_comp += 1
        if not res["locations"]:
            empty_loc += 1
        if len(res["locations"]) > 3:
            bloated_loc += 1

    print(f"Tested {len(files)} files: Joboko={joboko_count}, LinkedIn={linkedin_count}")
    print(f"Missing Companies: {missing_comp}/{len(files)}")
    print(f"Empty Locations: {empty_loc}/{len(files)}")
    print(f"Bloated Locations (>3 cities): {bloated_loc}/{len(files)}")

if __name__ == "__main__":
    run_test()
