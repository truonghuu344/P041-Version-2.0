import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StructuredJobDetail from '../StructuredJobDetail';
import {
  classifyHeading,
  extractStructuredSections,
  renderStructuredJobDetailHtml,
} from '@/lib/structuredJobDetail';

describe('Universal Structured Job Detail Pipeline & Hierarchical Renderer', () => {
  describe('Semantic Heading Classification', () => {
    it('correctly classifies standard and custom headings while preserving wording', () => {
      expect(classifyHeading('Trách nhiệm chính')?.type).toBe('responsibilities');
      expect(classifyHeading('What you will do')?.type).toBe('responsibilities');
      expect(classifyHeading("How You'll Make an Impact")?.type).toBe('overview');
      expect(classifyHeading('Beyond the core')?.type).toBe('nice_to_have');
      expect(classifyHeading("What We're Looking For")?.type).toBe('must_have');
      expect(classifyHeading('What We Offer')?.type).toBe('benefits');
      expect(classifyHeading('Learn More About Us')?.type).toBe('notes');
    });
  });

  describe('Test Case 1: 02 Junior Cloud Engineer (AWS/Azure) (JD-054)', () => {
    const rawCloudJD = `
Top 3 Reasons To Join Us
Lương và chế độ đãi ngộ hấp dẫn.
Môi trường làm việc cởi mở, năng động.
Có cơ hội phát triển, thăng tiến.

The Job
<p><strong>Tổng quan công việc</strong></p>
<p>Vị trí Cloud Engineer (2-3 năm kinh nghiệm) để tham gia vào đội ngũ kỹ thuật, chịu trách nhiệm chính trong việc thiết kế, triển khai và migration hệ thống lên nền tảng điện toán đám mây, đảm bảo hệ thống vận hành ổn định, tối ưu và bảo mật.</p>
<p><strong>Trách nhiệm chính</strong></p>
<ul>
<li>Triển khai & Migration : Trực tiếp tham gia vào các dự án Migration hệ thống từ On-premise lên Cloud hoặc giữa các Cloud với nhau.</li>
<li>Tự động hóa hạ tầng: Thiết kế và cấu hình hạ tầng dạng mã (Infrastructure as Code - IaC) để tự động hóa việc triển khai hệ thống.</li>
<li>Quản trị & Tối ưu: Giám sát, bảo trì và tối ưu hóa hiệu năng, chi phí trên các nền tảng Cloud.</li>
<li>Phối hợp: Làm việc chặt chẽ với đội ngũ Phát triển (Developers) và Vận hành để đảm bảo hệ thống vận hành liên tục (24/7).</li>
</ul>

Your Skills and Experience
<p><strong>Yêu cầu bắt buộc (Must-have):</strong></p>
<ul>
<li>Kinh nghiệm: Từ 2 - 3 năm làm việc trực tiếp với Cloud trong lĩnh vực migration và triển khai hệ thống.</li>
<li>Nền tảng Cloud: Thành thạo AWS. Có nền tảng kiến thức và hiểu biết tốt về Azure (Có thể đào tạo thêm nâng cao).</li>
<li>Hạ tầng dạng mã (IaC): Biết viết và sử dụng thành thạo ít nhất một trong các công cụ: Terraform, CloudFormation, hoặc Bicep.</li>
<li>Hệ điều hành: Làm việc tốt với hệ điều hành Linux và thành thạo các câu lệnh Linux CLI / Shell Scripting.</li>
</ul>

<p><strong>Điểm cộng (Nice-to-have):</strong></p>
<ul>
<li>Có kinh nghiệm hoặc tư duy về DevOps (Cấu hình CI/CD Pipelines bằng Jenkins, GitLab CI, GitHub Actions, v.v.).</li>
<li>Có kinh nghiệm làm việc với Containerization (Docker, Kubernetes).</li>
<li>Có các chứng chỉ quốc tế của AWS (ví dụ: AWS SysOps, AWS Solutions Architect) hoặc Azure là một lợi thế lớn.</li>
</ul>

<p><strong>Kỹ năng mềm cần thiết:</strong></p>
<ul>
<li>Kỹ năng giải quyết vấn đề (Troubleshooting) và tư duy logic tốt.</li>
<li>Khả năng đọc hiểu tài liệu kỹ thuật bằng Tiếng Anh tốt.</li>
<li>Tinh thần chủ động và trách nhiệm cao trong công việc.</li>
</ul>

Why You'll Love Working Here
<p><i><strong>Môi trường làm việc cởi mở, năng động:</strong></i></p>
<ul>
<li>Làm việc với những đồng nghiệp thân thiện, vui vẻ, hòa đồng luôn giúp đỡ nhau</li>
<li>Tôn trọng ý kiến cá nhân, đề cao sự sáng tạo.</li>
<li>Văn phòng làm việc rộng rãi, trang phục tự do.</li>
</ul>
<p><i><strong>Có cơ hội phát triển, thăng tiến:</strong></i></p>
<ul>
<li>Được đào tạo thêm nghiệp vụ, công nghệ mới và ngoại ngữ giao tiếp.</li>
<li>Có nhiều hoạt động nâng cao chuyên môn (Seminar, Workshop,Techtalk...)</li>
<li>Hỗ trợ thi chứng chỉ năng lực chuyên môn.</li>
</ul>
<p><i><strong>Chế độ đãi ngộ hấp dẫn:</strong></i></p>
<ul>
<li>Review lương: 1 lần/ năm; Thưởng: 2 lần/ năm; Thưởng doanh thu dự án theo quý và theo tình hình doanh thu của công ty.</li>
<li>12 ngày nghỉ phép, 3 ngày nghỉ hè và 4 ~ 5 ngày nghỉ có lương của riêng công ty/ năm.</li>
<li>Tham gia hoạt động câu lạc bộ: Bóng bàn, bơi, bóng đá, đọc sách, E-sports (PES, AOE, CS, LOL)...</li>
<li>Được tôn vinh nhân viên xuất sắc hàng tháng/ quý/ năm.</li>
</ul>
    `;

    const cloudJob = {
      source_id: 'JD-054',
      title: '02 Junior Cloud Engineer (AWS/Azure)',
      company: 'Extreme Việt Nam',
      location: 'Hà Nội',
      work_mode: 'Hybrid',
      employment_type: 'Full-time',
      salary: '900 - 1,300 USD',
      openings: 2,
      skills: ['Cloud', 'Linux', 'CloudFormation', 'Terraform', 'Azure', 'AWS'],
      description: rawCloudJD,
    };

    it('preserves full semantic hierarchy for Cloud Engineer JD without flattening headers', () => {
      const sections = extractStructuredSections(cloudJob);
      const sectionTypes = sections.map((s) => s.type);

      expect(sectionTypes).toContain('overview');
      expect(sectionTypes).toContain('responsibilities');
      expect(sectionTypes).toContain('must_have');
      expect(sectionTypes).toContain('nice_to_have');
      expect(sectionTypes).toContain('soft_skills');
      expect(sectionTypes).toContain('benefits');

      // Overview section has position summary
      const overview = sections.find((s) => s.type === 'overview');
      expect(overview?.items.some((i) => i.includes('Vị trí Cloud Engineer (2-3 năm kinh nghiệm)'))).toBe(true);

      // Responsibilities section has tasks
      const resp = sections.find((s) => s.type === 'responsibilities');
      expect(resp?.items.some((i) => i.includes('Triển khai & Migration'))).toBe(true);

      // Benefits section has sub-sections
      const ben = sections.find((s) => s.title === "Why You'll Love Working Here" || (s.subSections && s.subSections.length > 0));
      expect(ben?.subSections).toBeDefined();
      expect(ben?.subSections?.length).toBeGreaterThanOrEqual(3);

      // Verify structural headings are NOT ordinary bullet items
      const allItems = sections.flatMap((s) => [
        ...s.items,
        ...(s.subSections?.flatMap((sub) => sub.items) || []),
      ]);
      expect(allItems).not.toContain('Trách nhiệm chính');
      expect(allItems).not.toContain('Yêu cầu bắt buộc (Must-have):');
      expect(allItems).not.toContain('Điểm cộng (Nice-to-have):');
      expect(allItems).not.toContain("Why You'll Love Working Here");
    });
  });

  describe('Test Case 2: JD Full Stack Developer Client Facing (JD-083 format)', () => {
    const fullStackJD = {
      source_id: 'JD-083',
      title: 'Full Stack Developer Client Facing',
      company: 'Trusting Social',
      location: 'Hồ Chí Minh',
      work_mode: 'Onsite',
      employment_type: 'Full-time',
      seniority: 'Mid-Senior level',
      source_url: 'https://www.linkedin.com/jobs/view/full-stack-client-facing',
      source_name: 'LinkedIn',
      description: `
Trusting Social is an AI Fintech pioneer that's revolutionizing credit access in emerging markets. Our mission is "Advancing AI to Meet the Financial Needs of Everyday Consumers with Empathy."

How You'll Make an Impact
Join Trusting Social as a Full-Stack AI Engineer II and help build products that are transforming financial services in Vietnam and beyond. You will contribute to our Co-Lending partnership initiatives, building systems across the full stack (backend, web and mobile).

What You'll Do
<ul>
<li>Deliver high-quality features end-to-end across the full stack (backend, web, mobile), working with cross-functional teams.</li>
<li>Work AI-native, orchestrating agents: frame the problem for the agent, delegate the implementation, and review quality.</li>
<li>Follow Agile/DevOps and CI/CD to deliver quality code at speed.</li>
</ul>

Beyond the core
These Are The Dimensions We Grow Our Engineers Into — And It's a Plus If You Already Operate In One Or More Of Them:
<ul>
<li>Domain expert &amp; architect: learn a relevant partner/product area and encode its rules into reusable skills and docs.</li>
<li>Platform &amp; operations owner: operate and monitor agent-assisted systems in production.</li>
<li>Partner-facing engineer: manage trust at the partner/client boundary within your scope, and communicate clearly across functions.</li>
</ul>

What We're Looking For
<ul>
<li>Full-stack engineering: solid technical foundation with 4+ years of software engineering across backend and frontend.</li>
<li>Security-aware by default: you keep data protection, access control, and auditability in mind.</li>
<li>Good communication skills with working proficiency in English.</li>
</ul>

What We Offer
<ul>
<li>Competitive compensation package, including 13th-month salary and performance bonuses.</li>
<li>Comprehensive health care coverage for you and your dependents.</li>
<li>Generous leave policies and flexible work hours.</li>
</ul>

Learn More About Us
https://trustingsocial.com | Follow our latest innovations on YouTube.
      `,
    };

    it('preserves natural section order, employer titles, and client-facing sub-dimensions', () => {
      const sections = extractStructuredSections(fullStackJD);
      const titles = sections.map((s) => s.title);

      expect(titles).toContain("How You'll Make an Impact");
      expect(titles).toContain("What You'll Do");
      expect(titles).toContain('Beyond the core');
      expect(titles).toContain("What We're Looking For");
      expect(titles).toContain('What We Offer');
      expect(titles).toContain('Learn More About Us');

      // Beyond the core section classifies as nice_to_have and has client facing sub-dimension
      const beyondCore = sections.find((s) => s.title === 'Beyond the core');
      expect(beyondCore?.type).toBe('nice_to_have');
      expect(beyondCore?.items.some((i) => i.includes('Partner-facing engineer'))).toBe(true);

      // Unclassified section 'Learn More About Us' is preserved under notes / other
      const learnMore = sections.find((s) => s.title === 'Learn More About Us');
      expect(learnMore?.type).toBe('notes');
      expect(learnMore?.items.some((i) => i.includes('trustingsocial.com'))).toBe(true);
    });

    it('renders clean HTML with link and no markdown leakage', () => {
      const html = renderStructuredJobDetailHtml(fullStackJD, { mode: 'modal' });
      expect(html).toContain('Full Stack Developer Client Facing');
      expect(html).toContain('Trusting Social');
      expect(html).toContain('How You&#039;ll Make an Impact');
      expect(html).toContain('Beyond the core');
      expect(html).toContain('https://www.linkedin.com/jobs/view/full-stack-client-facing');
      expect(html).not.toContain('&amp;amp;');
    });
  });

  describe('Test Case 3: Fresher AI Engineer with inline bullet dashes & embedded headers', () => {
    const aiJob = {
      source_id: 'JD-AI-01',
      title: 'Fresher AI Engineer',
      company: 'FPT Software HCM',
      location: 'Hồ Chí Minh',
      seniority: 'Fresher',
      employment_type: 'Full-time',
      source_url: 'https://careers.fpt-software.com/job/fresher-ai',
      description: `
Tổng quan vị trí
Tuyển dụng Fresher AI Engineer tham gia vào các dự án nghiên cứu và phát triển GenAI và Computer Vision.

Quyền lợi & Đãi ngộ
Làm việc trong môi trường toàn cầu cùng các chuyên gia AI - Tham gia dự án triệu đô - Được đào tạo bài bản theo lộ trình - Thu nhập cạnh tranh ## YÊU CẦU ỨNG TUYỂN: - Sinh viên năm 4 hoặc mới tốt nghiệp ngành CNTT - Đam mê nghiên cứu AI/ML - GPA từ 3.2/4.0 trở lên - Tiếng Anh IELTS 6.0+
      `,
    };

    it('splits inline dash bullets and separates embedded requirements correctly', () => {
      const sections = extractStructuredSections(aiJob);
      const types = sections.map((s) => s.type);

      expect(types).toContain('overview');
      expect(types).toContain('benefits');
      expect(types).toContain('must_have');

      const ben = sections.find((s) => s.type === 'benefits');
      expect(ben?.items.length).toBeGreaterThanOrEqual(3);

      const must = sections.find((s) => s.type === 'must_have');
      expect(must?.items.length).toBeGreaterThanOrEqual(3);
      expect(must?.items.some((i) => i.includes('Sinh viên năm 4'))).toBe(true);
      expect(must?.items.some((i) => i.includes('GPA từ 3.2/4.0'))).toBe(true);
    });

    it('renders cleanly in React component without crashes', () => {
      render(<StructuredJobDetail job={aiJob} options={{ mode: 'modal' }} />);
      expect(screen.getByText('Fresher AI Engineer')).toBeInTheDocument();
      expect(screen.getByText('FPT Software HCM')).toBeInTheDocument();
    });
  });
});
