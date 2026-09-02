export interface InstitutionConfig {
  facultyName: string;
  universityName: string;
  address: string;
  email: string;
  hotline: string;
  workingHours: string;
  websiteUrl?: string;
}

export interface PartnerItem {
  id: string;
  name: string;
  logo?: string;
  industry: string;
  description?: string;
}

export interface ResourceItem {
  id: string;
  label: string;
  description: string;
  category: 'guide' | 'policy' | 'faq';
  content?: string;
}

export interface LegalLinkItem {
  id: string;
  label: string;
  title: string;
  content: string;
}

export const INSTITUTION_CONFIG: InstitutionConfig = {
  facultyName: 'Khoa Công nghệ Thông tin',
  universityName: 'Trường Đại học Công nghiệp TP.HCM',
  address: '12 Nguyễn Văn Bảo, Phường 4, Q. Gò Vấp, TP.HCM',
  email: 'fit@iuh.edu.vn',
  hotline: '(028) 38940 390',
  workingHours: 'Thứ Hai – Thứ Sáu (07:30 – 17:00)',
  websiteUrl: 'https://fit.iuh.edu.vn',
};

export const PARTNER_ECOSYSTEM: PartnerItem[] = [
  {
    id: 'kms',
    name: 'KMS Technology',
    industry: 'Phát triển phần mềm & AI',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYBcp02XJKKV3u3hxPGGHnYCHdY6Fttq5cnGLXDlHNiTrptghD8huuYIMMWL9s__zFAiWZxpyvInENiaaiEqDyT5-18FaH3x4DAm_cn7iHHXSysSJou3J_v1mm6cirISwvBeBeKYnPz73J4bw47felckiEwAJrmffh6r-A_Owgn6wdynqzMTEIdgAnBYGlFmh1VaKB4xOnDVRcGoLA0gs1wkxr5bPIaZA3PHsUXfFPi7prHKMKZFY',
  },
  {
    id: 'fpt',
    name: 'FPT Software',
    industry: 'Phần mềm & Đám mây',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbqaf44kOh7Tt27ZsgYqyDpie-wVR3ZvQ_yvdZizSzO1OaYcCKsldBr9FpaGs_10D5wt3M-Xut2WLwgjqwNgfkLBbt1XWOj0YWO1BnjFnbJmwKJ6P0BpRoxTrlQhgtUrsujWo0OSknBIEjRw_GCSH9M5cgOzQsvMJF4MIckHNvBsKRakTeae89aFstrT5hxQsMqzBzQbfhKd7mTd67p5Rj2Qds9YijvUjNRaOEUGZn5gpiiWJFlus',
  },
  {
    id: 'gameloft',
    name: 'Gameloft',
    industry: 'Game & Mobile Entertainment',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI1am82estzh0MJbaaILrARf--XIHh-ta8Fhti7la8TwNBaGVa7KOjvUX4ITuVKofOxkmlMfLvJlpgfOPXKd8QDsqi_CfCsUAXRSsp3VXLZgzBFIwb16n5TkFS9vslRR9io0QOQJNmWMLxGr8LzmE6illRkj_Y6lO9S9j27U2f88Bk6ICfX2cb-rhgsi2Uq8fUXjw1Jg_rSJqVctTEohnWlGi9Sy0CBNTwQbsxlkYoZ4XkO2qwB6E',
  },
  {
    id: 'tma',
    name: 'TMA Solutions',
    industry: 'Viễn thông & IoT',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI1am82estzh0MJbaaILrARf--XIHh-ta8Fhti7la8TwNBaGVa7KOjvUX4ITuVKofOxkmlMfLvJlpgfOPXKd8QDsqi_CfCsUAXRSsp3VXLZgzBFIwb16n5TkFS9vslRR9io0QOQJNmWMLxGr8LzmE6illRkj_Y6lO9S9j27U2f88Bk6ICfX2cb-rhgsi2Uq8fUXjw1Jg_rSJqVctTEohnWlGi9Sy0CBNTwQbsxlkYoZ4XkO2qwB6E',
  },
  {
    id: 'global-cybersoft',
    name: 'Global CyberSoft',
    industry: 'Công nghệ thông tin & Nhúng',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_eoGZO88yKZWZFXfVYr78KQstygUZRd8LhpPEES-JTL_Sz2GwhiYbwmLarr8cCzWBw3hhNHnx4tIMlRVQODktdnxACdg_veFgyOxsb5iaQl4qlRy-MfLlpOeqcBGRs0LAJ48tC4jfJMcidJhFy8yjspbbBqL_orxPE1RH1lnFaBj-3R4W8kUoNmEvYnQjAbOfzQ0XRbl3CslE1z_uSovw2CQjAbz-x2qMWw1wWAvytXt6shrjriU',
  },
];

export const COUNSELOR_RESOURCES: ResourceItem[] = [
  {
    id: 'help-center',
    label: 'Trung tâm trợ giúp',
    description: 'Hướng dẫn toàn diện cho Cố vấn học tập và Giảng viên hướng dẫn.',
    category: 'guide',
    content: 'Cổng hỗ trợ Cố vấn: Giải đáp quy trình xét duyệt hồ sơ, tiếp nhận Talent Request và theo dõi thực tập sinh viên.',
  },
  {
    id: 'user-guide',
    label: 'Hướng dẫn sử dụng',
    description: 'Tài liệu hướng dẫn thao tác chi tiết từng tính năng trên cổng Cố vấn.',
    category: 'guide',
    content: 'Tài liệu hướng dẫn Cố vấn: Cách lọc sinh viên theo chuyên ngành, thẩm định CV, cấp huy hiệu xác nhận và tạo tiến cử doanh nghiệp.',
  },
  {
    id: 'internship-flow',
    label: 'Quy trình thực tập',
    description: 'Quy định chuẩn 3 bên: Sinh viên – Nhà trường – Doanh nghiệp.',
    category: 'policy',
    content: 'Quy trình thực tập doanh nghiệp: Gồm 12 tuần làm việc thực tế, nộp báo cáo tuần định kỳ và đánh giá điểm số 3 bên.',
  },
  {
    id: 'cv-guideline',
    label: 'Hướng dẫn CV',
    description: 'Chuẩn đánh giá và gợi ý bổ sung kỹ năng chuyên môn cho sinh viên.',
    category: 'guide',
    content: 'Khung năng lực & Chuẩn CV: Cách nhận diện kỹ năng trọng yếu, kiểm chứng bằng chứng dự án và định hướng lộ trình học tập.',
  },
  {
    id: 'referral-guideline',
    label: 'Hướng dẫn tiến cử',
    description: 'Tiêu chí lựa chọn và gửi ứng viên phù hợp với yêu cầu nhân sự.',
    category: 'policy',
    content: 'Nguyên tắc tiến cử (Consent-First): Cố vấn lựa chọn ứng viên có độ phù hợp cao, gửi yêu cầu đồng ý (Consent) cho sinh viên trước khi chuyển tiếp sang Doanh nghiệp.',
  },
  {
    id: 'faq',
    label: 'Câu hỏi thường gặp',
    description: 'Các thắc mắc phổ biến về quy chế và thời hạn thực tập tốt nghiệp.',
    category: 'faq',
    content: 'Giải đáp thắc mắc: Thời gian xử lý tiến cử (tối đa 48h), quy trình đổi Mentor thực tập và xác thực tín chỉ môn học.',
  },
];

export const SYSTEM_LEGAL_LINKS: LegalLinkItem[] = [
  {
    id: 'privacy',
    label: 'Quyền riêng tư',
    title: 'Chính sách Quyền riêng tư',
    content: 'Career Assistant X cam kết bảo mật tuyệt đối dữ liệu sinh viên, giảng viên và đối tác doanh nghiệp. Hồ sơ và báo cáo STAR chỉ được chia sẻ khi có sự đồng thuận rõ ràng (Consent-First).',
  },
  {
    id: 'terms',
    label: 'Điều khoản sử dụng',
    title: 'Điều khoản Sử dụng Hệ thống',
    content: 'Hệ thống phục vụ mục đích kết nối học thuật và thực tập hướng nghiệp. Cố vấn và Sinh viên sử dụng tài khoản trường cấp và tuân thủ chuẩn mực đạo đức đào tạo.',
  },
  {
    id: 'data-policy',
    label: 'Chính sách dữ liệu',
    title: 'Chính sách Quản lý & Bảo vệ Dữ liệu',
    content: 'Mọi dữ liệu học tập, CV và đánh giá thực tập được lưu trữ an toàn theo tiêu chuẩn bảo vệ dữ liệu giáo dục đại học, phục vụ kiểm định chất lượng và hỗ trợ việc làm.',
  },
  {
    id: 'help',
    label: 'Trợ giúp',
    title: 'Hỗ trợ Kỹ thuật & Nghiệp vụ',
    content: 'Liên hệ Ban Hỗ trợ Kỹ thuật qua email: fit@iuh.edu.vn hoặc hotline: (028) 38940 390 trong giờ hành chính để được hỗ trợ nhanh chóng.',
  },
];

export const SYSTEM_VERSION = 'v1.0';
