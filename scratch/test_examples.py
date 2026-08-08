import sys
import os
sys.path.insert(0, '.')
import json
from ingestion.cleaner_jds import (
    clean_text_by_source, smart_extract_sections, extract_and_classify_skills,
    normalize_domain, infer_job_level, infer_employment_type, infer_remote_type,
    infer_education, infer_languages, infer_salary_range, infer_experience_required
)

sys.stdout.reconfigure(encoding='utf-8')

# Example 1: LinkedIn GeoComply
text_linkedin = """
Security Software Engineer Intern 
GeoComply
Ho Chi Minh City, Ho Chi Minh City, Vietnam · About the job
About GeoComply
We’re GeoComply! We are at the forefront of geolocation, cybersecurity, and anti-fraud innovation...
The Role
The Security Software Engineer Intern contributes to GeoComply’s success by helping strengthen GeoGuard’s VPN...
Key Responsibilities
Investigate performance issues in our VPN/proxy data collection systems — low IP collection rates, coverage gaps, and recurring failures across proxy, residential-proxy, browser-extension, and smart-DNS based collectors (PHP-based). 
Diagnose root causes of degradation and identify what else we can do to improve collection rate, freshness, and coverage. 
Fix common failures following established procedures, and propose enhancements to avoid repeat failures. 
Build new collectors for VPN/proxy providers following existing templates, and enable auto-updater tooling for new providers. 
Support the config auto-updater (JS-based): fix recurring updater failures, handle CAPTCHA-related issues (Cloudflare, reCAPTCHA v3), and manually update configs when auto-updaters fail. 
Run VPN testing across a set of VPN applications and research current VPN technology to understand how it behaves and evolves. 
Apply AI tools to research VPN providers — identify their spoofing techniques and the corresponding detection and protection methods GeoGuard can use against them. 
Explore and propose what else we can do to detect VPN users — new signals, heuristics, or techniques that improve detection coverage. 
Query performance and detection data to identify anomalies and establish healthy baselines and alert thresholds. 
Build automated, data-driven monitoring — from raw data, to anomaly/alert-detection logic, to a visual dashboard the team can use on an ongoing basis — so degradation is caught proactively rather than after the fact. 
Document testing results, recurring failure patterns, and research findings to drive process improvement. 
Who You Are
Recently graduated or in pursuit of a degree in Computer Science, Software Engineering, or a related field. 
Basic backend development knowledge (PHP and/or Golang preferred). 
Comfortable querying and working with data to spot patterns and anomalies. 
Good to have: interest in or exposure to networking concepts (VPNs, proxies, DNS, IP infrastructure). 
Proficient with AI tools and able to apply them effectively to research VPN providers, spoofing techniques, and detection/protection methods, and to accelerate development. 
Demonstrated skills in analytical thinking, problem-solving, and attention to detail. 
Demonstrated ability to manage time and prioritize tasks to meet deadlines. 
Ability to work in small collaborative teams in a dynamic working environment. 
English language skills: fluent in reading and writing, comfortable with listening and speaking. 
Collaborative and client-centric mindset. 
Why GeoComply?
We Care About Our Team
Our GeoComply team is talented, driven and hard-working, and is known for its positive attitude and energy. At GeoComply, we take care of our employees with the total package. Team members are generously rewarded with competitive salaries, incentives, and a comprehensive benefits program.
We value in-person collaboration
GeoComply culture thrives on a dynamic mix of in-person energy and independent focus and we champion a hybrid work model that blends the energy of in-person collaboration with the flexibility to work from home. Our 3-day in-office policy fosters teamwork and innovation...
"""

# Example 2: Joboko Blueco
text_joboko = """
TUYỂN DỤNG LẬP TRÌNH VIÊN FRONTEND
Công ty Cổ phần Blueco toàn cầu 
Hết hạn: Còn 28 ngày Thu nhập: thu nhập từ 12 đến 30 tr
Loại hình: Toàn thời gian
Chức vụ: Nhân viên
Kinh nghiệm: 2 năm
phần mềm
frontend
html
javascript
Mở rộng quy mô, thêm các dự án lớn, Blueco tuyển dụng Lập trình viên Frontend
Số lượng : 10 người
Kinh nghiệm : trên 2 năm kinh nghiệm
Thời gian làm việc : 8h00 - 12h00 ; 13h30 - 17h30 ( Thứ 2 đến hết thứ Sáu hàng tuần )
Mô tả công việc:
Tham gia phát triển các ứng dụng web trên nền tảng javacript phục vụ khách hàng
Tham gia vào quá trình phân tích, thiết kế, phát triển và bảo trì hệ thống, ứng dụng.
Tạo thiết kế chi tiết và viết các tài liệu kỹ thuật khi được yêu cầu.
Trực tiếp viết mã nguồn và thực hiện Unit test theo tài liệu phân tích, thiết kế.
Tham gia các hoạt động review tài liệu, review mã nguồn.
Yêu cầu công việc:
Hiểu biết về cách làm việc với HTML, Javascript, CSS, XML.
Thông thạo một trong các nền tảng: Angular, Vuejs, Reactjs
Có tư duy logic tốt
Tốt nghiệp các trường được đào tạo về chuyên ngành Công nghệ thông tin.
2+ năm kinh nghiệm trở lên
Đam mê, có trách nhiệm cao trong công việc.
Có khả năng làm việc độc lập và làm việc nhóm.
Thu nhập và quyền lợi :
Mức thu nhập từ 12 đến 30 triệu, tương ứng với năng lực
Làm việc trong môi trường trẻ trung, năng động, vui vẻ
Làm việc với các kỹ sư nhiều kinh nghiệm trong lĩnh vực CNTT
Quy trình làm việc chuyên nghiệp theo chuẩn dự án phần mềm quốc tế
Công ty mở rộng quy mô nhiều vị trí thăng tiến, có cơ hội trở thành trưởng nhóm lập trình
Được đào tạo về quy trình Agile áp dụng vào dự án
Được đào tạo về Oralce và PL/SQL
Được đào tạo về các framework như Vuejs, Angular, React, java spring boot.
Chế độ bảo hiểm, thưởng, du lịch:
Tham gia BHXH, BHYT, BHTN ngay sau kết thúc thử việc
Bảo hiểm Bảo Việt care cho nhân viên là người thân
Thưởng tháng 13, thưởng tết dương lịch, tết âm lịch hấp dẫn
Thưởng dự án, thưởng tháng/quý theo năng lực và cống hiến
Tham gia các hoạt động thường niên của công ty: teambuilding, camping, birthday, YEP, du lịch...
Thường xuyên có teabreak, chương trình "Thứ Sáu vui vẻ" hàng tuần...
Các hoạt động thú vị khác cho từng dịp : 8/3, 20/10, noel, trung thu...
Thông tin chung
Thu nhập: thu nhập từ 12 đến 30 tr
Giới thiệu công ty
Blueco Global (BLUECO) cung cấp dịch vụ Phát triển phần mềm cho các doanh nghiệp trong và ngoài nước.
Quy mô công ty
Từ 101 - 500 nhân viên
"""

def process(title, comp, text, src):
    clean_desc = clean_text_by_source(text, src)
    smart_secs = smart_extract_sections(clean_desc)
    skills = extract_and_classify_skills(smart_secs['requirements'], clean_desc)
    domain = normalize_domain(title, clean_desc)
    level = infer_job_level(title, clean_desc)
    emp = infer_employment_type(clean_desc)
    remote = infer_remote_type(clean_desc)
    edu = infer_education(clean_desc)
    sal = infer_salary_range(clean_desc)
    exp = infer_experience_required(title, clean_desc)
    
    must_have_obj = {
        'skills': skills['must_have_skills'],
        'experience': exp,
        'education': edu,
        'job_level': level,
        'requirements': smart_secs['requirements']
    }
    
    must_str = ', '.join(skills['must_have_skills']) if skills['must_have_skills'] else 'N/A'
    req_snip = ' '.join(smart_secs['requirements'][:4]) if smart_secs['requirements'] else 'N/A'
    
    must_have_text = f'Vị trí: {title}. Kỹ năng bắt buộc: {must_str}. Kinh nghiệm: {exp}. Yêu cầu: {req_snip}'
    embedding_text = f'Job Title: {title} | Company: {comp} | Domain: {domain} | Level: {level} | Must Have Skills: {must_str} | Experience: {exp} | Requirements: {req_snip}'

    return {
        'job_title': title,
        'company_name': comp,
        'source': src,
        'job_level': level,
        'employment_type': emp,
        'remote_type': remote,
        'domain_category': domain,
        'salary_range': sal,
        'experience_required': exp,
        'must_have': must_have_obj,
        'must_have_skills': skills['must_have_skills'],
        'nice_to_have_skills': skills['nice_to_have_skills'],
        'must_have_text': must_have_text,
        'embedding_text': embedding_text,
        'responsibilities': smart_secs['responsibilities'][:3],
        'benefits': smart_secs['benefits'][:3]
    }

if __name__ == '__main__':
    print("=== EXAMPLE 1: LINKEDIN - GEOCOMPLY ===")
    r1 = process('Security Software Engineer Intern', 'GeoComply', text_linkedin, 'LinkedIn')
    print(json.dumps(r1, ensure_ascii=False, indent=2))

    print("\n=== EXAMPLE 2: JOBOKO - BLUECO ===")
    r2 = process('TUYỂN DỤNG LẬP TRÌNH VIÊN FRONTEND', 'Công ty Cổ phần Blueco toàn cầu', text_joboko, 'Joboko')
    print(json.dumps(r2, ensure_ascii=False, indent=2))
