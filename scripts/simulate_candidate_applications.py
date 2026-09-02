"""Simulate realistic student applications for Enterprise Job Descriptions."""
import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
import random

# Add backend to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import select
from src.core.security import get_password_hash
from src.db.database import AsyncSessionLocal
from src.db.models import (
    CV,
    CVSnapshot,
    JobApplication,
    JobDescription,
    Notification,
    User,
    generate_uuid,
)

STUDENT_DATA = [
    {
        "name": "Nguyễn Hoàng Nam",
        "email": "hoangnam.dev@gmail.com",
        "title": "Fullstack Software Engineer",
        "phone": "0987123456",
        "location": "Hồ Chí Minh",
        "skills": ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "REST API", "Tailwind CSS"],
        "education": [
            {"school": "Đại học Bách Khoa TP.HCM", "degree": "Kỹ sư Khoa học Máy tính", "gpa": "3.6/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "VNG Corporation",
                "role": "Frontend Developer Intern",
                "period": "06/2023 - 12/2023",
                "description": "Xây dựng giao diện web portal quản lý tài khoản game với React và Next.js. Tối ưu hiệu năng tải trang giảm 35% LCP."
            }
        ],
        "projects": [
            {
                "name": "AI Career Copilot Platform",
                "role": "Lead Developer",
                "description": "Nền tảng hỗ trợ đối chiếu và tối ưu CV theo JD sử dụng Next.js, FastAPI, LangGraph và Gemini AI."
            }
        ],
        "certifications": ["AWS Certified Cloud Practitioner", "IELTS 7.5"],
        "match_score": 92.5,
        "status": "submitted",
    },
    {
        "name": "Trần Minh Đức",
        "email": "minhduc.tran99@gmail.com",
        "title": "Backend / Python Developer",
        "phone": "0912345678",
        "location": "Hà Nội",
        "skills": ["Python", "FastAPI", "Django", "PostgreSQL", "Redis", "Docker", "RabbitMQ", "Microservices"],
        "education": [
            {"school": "Đại học Quốc Gia Hà Nội (UET)", "degree": "Cử nhân Công nghệ Thông tin", "gpa": "3.5/4.0", "period": "2019 - 2023"}
        ],
        "experience": [
            {
                "company": "FPT Software",
                "role": "Junior Backend Engineer",
                "period": "01/2023 - Nay",
                "description": "Phát triển hệ thống microservices xử lý 500k request/ngày bằng FastAPI và PostgreSQL."
            }
        ],
        "projects": [
            {
                "name": "E-Commerce Realtime Order Engine",
                "role": "Backend Lead",
                "description": "Hệ thống xử lý đơn hàng với Redis Pub/Sub và WebSocket."
            }
        ],
        "certifications": ["CKA (Certified Kubernetes Administrator)"],
        "match_score": 88.0,
        "status": "shortlisted",
    },
    {
        "name": "Lê Thu Hà",
        "email": "thuha.le.design@gmail.com",
        "title": "UI/UX & Product Designer",
        "phone": "0909876543",
        "location": "Hồ Chí Minh",
        "skills": ["Figma", "Design Systems", "User Research", "Wireframing", "Prototyping", "HTML/CSS", "Usability Testing"],
        "education": [
            {"school": "Đại học Kiến Trúc TP.HCM", "degree": "Cử nhân Thiết kế Đồ họa", "gpa": "3.7/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "Tiki Corporation",
                "role": "Product Design Intern",
                "period": "03/2023 - 09/2023",
                "description": "Thiết kế luồng thanh toán (Checkout flow) mới giúp tăng tỷ lệ hoàn tất đơn hàng lên 14%."
            }
        ],
        "projects": [
            {
                "name": "Fintech Mobile Banking App Redesign",
                "role": "Product Designer",
                "description": "Thiết kế toàn diện Design System 50+ components cho ứng dụng tài chính cá nhân."
            }
        ],
        "certifications": ["Google UX Design Professional Certificate"],
        "match_score": 79.5,
        "status": "submitted",
    },
    {
        "name": "Phạm Quốc Bảo",
        "email": "quocbao.pham.ai@gmail.com",
        "title": "AI & Data Engineer",
        "phone": "0934567890",
        "location": "Hồ Chí Minh",
        "skills": ["Python", "PyTorch", "LangChain", "LLMs", "RAG", "SQL", "Docker", "Pandas", "Scikit-Learn"],
        "education": [
            {"school": "Đại học Khoa học Tự nhiên TP.HCM", "degree": "Cử nhân Khoa học Dữ liệu", "gpa": "3.8/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "VinAI Research",
                "role": "AI Resident / Intern",
                "period": "06/2023 - 01/2024",
                "description": "Nghiên cứu mô hình RAG tối ưu retrieval cho tài liệu tiếng Việt với Vector Database (pgvector/Qdrant)."
            }
        ],
        "projects": [
            {
                "name": "Medical Question Answering Assistant",
                "role": "AI Engineer",
                "description": "Trợ lý AI tra cứu triệu chứng y khoa với độ chính xác phản hồi đạt 89%."
            }
        ],
        "certifications": ["DeepLearning.AI Generative AI Specialist", "IELTS 8.0"],
        "match_score": 94.0,
        "status": "interview",
    },
    {
        "name": "Đỗ Hải Yến",
        "email": "haiyen.do98@gmail.com",
        "title": "Frontend React / Next.js Developer",
        "phone": "0978901234",
        "location": "Hà Nội",
        "skills": ["JavaScript", "TypeScript", "React", "Next.js", "Redux", "Tailwind CSS", "Jest", "Git"],
        "education": [
            {"school": "Đại học Bách Khoa Hà Nội", "degree": "Kỹ sư Công nghệ Thông tin", "gpa": "3.4/4.0", "period": "2019 - 2023"}
        ],
        "experience": [
            {
                "company": "Viettel Solutions",
                "role": "Frontend Developer",
                "period": "07/2023 - Nay",
                "description": "Xây dựng dashboard quản lý viễn thông cho doanh nghiệp trên nền tảng Next.js 14."
            }
        ],
        "projects": [
            {
                "name": "Smart HR Management System",
                "role": "Frontend Lead",
                "description": "Giao diện quản lý nhân sự, chấm công và bảng lương với 100+ biểu đồ tương tác."
            }
        ],
        "certifications": ["Meta Front-End Developer Certificate"],
        "match_score": 83.5,
        "status": "submitted",
    },
    {
        "name": "Vũ Tuấn Anh",
        "email": "tuananh.vu.qa@gmail.com",
        "title": "QA / Software Tester Automation",
        "phone": "0965432109",
        "location": "Đà Nẵng",
        "skills": ["Automation Testing", "Selenium", "Playwright", "Postman", "Cypress", "Python", "CI/CD", "Jira"],
        "education": [
            {"school": "Đại học Bách Khoa - ĐH Đà Nẵng", "degree": "Kỹ sư Phần mềm", "gpa": "3.3/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "KMS Technology",
                "role": "QC Engineer Intern",
                "period": "04/2023 - 10/2023",
                "description": "Viết và thực thi hơn 300 test case tự động bằng Playwright, giảm 50% thời gian regression test."
            }
        ],
        "projects": [
            {
                "name": "Automated End-to-End Test Suite for Fintech",
                "role": "QA Lead",
                "description": "Hệ thống CI test tự động tích hợp GitHub Actions."
            }
        ],
        "certifications": ["ISTQB Foundation Level (CTFL)"],
        "match_score": 68.0,
        "status": "submitted",
    },
    {
        "name": "Ngô Phương Linh",
        "email": "phuonglinh.ngo@gmail.com",
        "title": "Business Analyst / Product Owner",
        "phone": "0943210987",
        "location": "Hồ Chí Minh",
        "skills": ["Business Analysis", "Requirement Elicitation", "BPMN", "UML", "Agile/Scrum", "SQL", "Jira", "Figma"],
        "education": [
            {"school": "Đại học Kinh tế TP.HCM (UEH)", "degree": "Cử nhân Hệ thống Thông tin Quản lý", "gpa": "3.65/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "MoMo (M-Service)",
                "role": "Business Analyst Intern",
                "period": "05/2023 - 11/2023",
                "description": "Thu thập và chuẩn hóa yêu cầu cho tính năng Ví Trả Sau, viết hơn 40 tài liệu User Stories."
            }
        ],
        "projects": [
            {
                "name": "Omnichannel Retail Management Platform",
                "role": "Lead BA",
                "description": "Thiết kế kiến trúc nghiệp vụ luồng kho và đơn hàng đa kênh."
            }
        ],
        "certifications": ["ECBA (Entry Certificate in Business Analysis)"],
        "match_score": 75.0,
        "status": "shortlisted",
    },
    {
        "name": "Bùi Anh Tuấn",
        "email": "anhtuan.bui.mobile@gmail.com",
        "title": "Mobile App Developer (Flutter / React Native)",
        "phone": "0921098765",
        "location": "Hồ Chí Minh",
        "skills": ["Flutter", "Dart", "React Native", "TypeScript", "Firebase", "State Management (Bloc/Redux)", "REST API"],
        "education": [
            {"school": "Đại học Công nghệ Thông tin (UIT)", "degree": "Kỹ sư Kỹ thuật Phần mềm", "gpa": "3.55/4.0", "period": "2020 - 2024"}
        ],
        "experience": [
            {
                "company": "Zalo (VNG)",
                "role": "Mobile Developer Intern",
                "period": "06/2023 - 12/2023",
                "description": "Tham gia phát triển Mini App cho hệ sinh thái Zalo với hơn 100,000 người dùng hàng tháng."
            }
        ],
        "projects": [
            {
                "name": "Fitness & Calorie Tracker App",
                "role": "Lead Mobile Dev",
                "description": "Ứng dụng theo dõi sức khỏe và gợi ý thực đơn bằng AI trên iOS & Android."
            }
        ],
        "certifications": ["Google Associate Android Developer"],
        "match_score": 86.0,
        "status": "submitted",
    },
]


async def simulate():
    async with AsyncSessionLocal() as db:
        print("[Simulate] Fetching all Job Descriptions...")
        result = await db.execute(select(JobDescription))
        jds = result.scalars().all()

        if not jds:
            print("[Simulate] No Job Descriptions found. Creating a default Enterprise JD first...")
            # Find or create enterprise user
            ent_res = await db.execute(select(User).where(User.role == "enterprise"))
            enterprise_user = ent_res.scalars().first()
            if not enterprise_user:
                enterprise_user = User(
                    email="recruiter@techcorp.vn",
                    hashed_password=get_password_hash("Password123!"),
                    full_name="TechCorp Tuyển Dụng",
                    role="enterprise",
                )
                db.add(enterprise_user)
                await db.commit()
                await db.refresh(enterprise_user)

            jd = JobDescription(
                title="Senior Fullstack Web Developer (React / Python)",
                company="TechCorp Vietnam",
                location="Hồ Chí Minh",
                requirements_text="Thành thạo React, Next.js, Python FastAPI, PostgreSQL, Docker. Tối thiểu 1 năm kinh nghiệm thực chiến.",
                is_published=True,
                is_system=False,
                created_by_user_id=enterprise_user.id,
                normalized_json={
                    "employment_type": "Full-time",
                    "location": "Hồ Chí Minh",
                    "required_skills": ["React", "Next.js", "Python", "FastAPI", "PostgreSQL", "Docker"],
                    "job_overview": "Tuyển dụng kỹ sư Fullstack phát triển nền tảng SaaS hiện đại.",
                },
            )
            db.add(jd)
            await db.commit()
            await db.refresh(jd)
            jds = [jd]

        print(f"[Simulate] Found {len(jds)} Job Description(s). Creating {len(STUDENT_DATA)} candidate profiles...")

        created_count = 0
        now = datetime.now(UTC)

        for i, sdata in enumerate(STUDENT_DATA):
            # 1. Check or create student user
            u_res = await db.execute(select(User).where(User.email == sdata["email"]))
            student = u_res.scalars().first()
            if not student:
                student = User(
                    email=sdata["email"],
                    hashed_password=get_password_hash("Password123!"),
                    full_name=sdata["name"],
                    role="student",
                )
                db.add(student)
                await db.commit()
                await db.refresh(student)

            # 2. Check or create CV
            cv_res = await db.execute(select(CV).where(CV.user_id == student.id))
            cv = cv_res.scalars().first()
            if not cv:
                raw_cv_text = f"""HỌ VÀ TÊN: {sdata['name']}
Email: {sdata['email']} | SĐT: {sdata['phone']} | Địa chỉ: {sdata['location']}
Vị trí mục tiêu: {sdata['title']}

1. KỸ NĂNG CHUYÊN MÔN:
{', '.join(sdata['skills'])}

2. HỌC VẤN:
{sdata['education'][0]['degree']} - {sdata['education'][0]['school']} (GPA: {sdata['education'][0]['gpa']}) - Niên khóa: {sdata['education'][0]['period']}

3. KINH NGHIỆM LÀM VIỆC:
- {sdata['experience'][0]['role']} tại {sdata['experience'][0]['company']} ({sdata['experience'][0]['period']})
  + {sdata['experience'][0]['description']}

4. DỰ ÁN TIÊU BIỂU:
- {sdata['projects'][0]['name']} (Vai trò: {sdata['projects'][0]['role']})
  + {sdata['projects'][0]['description']}

5. CHỨNG CHỈ:
{', '.join(sdata['certifications'])}
"""
                cv = CV(
                    user_id=student.id,
                    title=f"CV_{sdata['name'].replace(' ', '_')}_{sdata['title'].replace(' ', '_')}",
                    raw_text=raw_cv_text,
                    parsed_json={
                        "personal": {
                            "full_name": sdata["name"],
                            "email": sdata["email"],
                            "phone": sdata["phone"],
                            "address": sdata["location"],
                            "title": sdata["title"],
                        },
                        "skills": sdata["skills"],
                        "education": sdata["education"],
                        "experience": sdata["experience"],
                        "projects": sdata["projects"],
                        "certifications": sdata["certifications"],
                    },
                )
                db.add(cv)
                await db.commit()
                await db.refresh(cv)

                # Snapshot
                snapshot = CVSnapshot(
                    cv_id=cv.id,
                    user_id=student.id,
                    version_number=1,
                    source_hash=f"hash_{student.id[:8]}",
                    raw_text=raw_cv_text,
                    profile_json=cv.parsed_json,
                    status="ready",
                )
                db.add(snapshot)
                await db.commit()

            # 3. Apply to each JD
            for jd in jds:
                app_res = await db.execute(
                    select(JobApplication).where(
                        JobApplication.jd_id == jd.id,
                        JobApplication.student_id == student.id,
                    )
                )
                existing_app = app_res.scalars().first()
                if not existing_app:
                    shared_time = now - timedelta(days=random.randint(1, 14), hours=random.randint(1, 23))
                    app = JobApplication(
                        jd_id=jd.id,
                        student_id=student.id,
                        cv_id=cv.id,
                        match_score=float(sdata["match_score"]),
                        status=sdata["status"],
                        shared_at=shared_time,
                    )
                    db.add(app)
                    await db.commit()
                    await db.refresh(app)
                    created_count += 1

                    # Recruiter Notification
                    if jd.created_by_user_id:
                        company_name = jd.company or "Doanh nghiệp"
                        notif = Notification(
                            recipient_user_id=jd.created_by_user_id,
                            recipient_role="enterprise",
                            actor_user_id=student.id,
                            actor_role="student",
                            type="APPLICATION_RECEIVED",
                            category="application",
                            entity_type="application",
                            entity_id=app.id,
                            job_id=jd.id,
                            application_id=app.id,
                            candidate_id=student.id,
                            title="Có ứng viên mới ứng tuyển",
                            message=f"Ứng viên {sdata['name']} vừa nộp hồ sơ ứng tuyển vào vị trí {jd.title} ({sdata['match_score']}% Match).",
                            priority="normal",
                            action_url=f"/jobs/{jd.id}/applications/{app.id}",
                            metadata_json={
                                "company_name": company_name,
                                "job_title": jd.title,
                                "candidate_name": sdata["name"],
                                "status": sdata["status"],
                                "match_score": sdata["match_score"],
                            },
                        )
                        db.add(notif)
                        await db.commit()

        print(f"[Simulate] Successfully simulated {created_count} candidate application(s)!")


if __name__ == "__main__":
    asyncio.run(simulate())
