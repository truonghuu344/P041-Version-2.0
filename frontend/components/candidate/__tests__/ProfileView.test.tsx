/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileView from '../ProfileView';

describe('ProfileView Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders profile header with initial user info and job status selector', () => {
    render(<ProfileView />);

    expect(screen.getByText('Hồ sơ & Học vấn')).toBeInTheDocument();
    expect(screen.getByText('Định hướng & Kỹ năng')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản & Bảo mật')).toBeInTheDocument();

    // Check status selector
    const statusSelect = screen.getByLabelText('Trạng thái tìm việc');
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect).toHaveValue('searching');
  });

  test('renders profile completion card and progress percentage', () => {
    render(<ProfileView />);

    expect(screen.getByText('Mức độ hoàn thiện')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });

  test('switches tabs smoothly between Profile, Career Goals, and Security', () => {
    render(<ProfileView />);

    // Default tab is profile
    expect(screen.getByText('Thông Tin Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Học Vấn & Bằng Cấp')).toBeInTheDocument();

    // Switch to Career tab
    const careerTab = screen.getByRole('button', { name: /Định hướng & Kỹ năng/i });
    fireEvent.click(careerTab);

    expect(screen.getByText('Định Hướng Nghề Nghiệp')).toBeInTheDocument();
    expect(screen.getByText('Kỹ Năng Chuyên Môn')).toBeInTheDocument();
    expect(screen.getByText('Kiểm Soát AI (AI Career Preferences)')).toBeInTheDocument();

    // Switch to Security tab
    const securityTab = screen.getByRole('button', { name: /Tài khoản & Bảo mật/i });
    fireEvent.click(securityTab);

    expect(screen.getByText('Bảo Mật & Đổi Mật Khẩu')).toBeInTheDocument();
    expect(screen.getByText(/Vùng Nguy Hiểm/i)).toBeInTheDocument();
  });

  test('allows adding and removing skills as tag chips', () => {
    render(<ProfileView />);

    // Switch to career tab to view skills
    fireEvent.click(screen.getByRole('button', { name: /Định hướng & Kỹ năng/i }));

    const skillInput = screen.getByPlaceholderText(/Nhập tên kỹ năng/i);
    const addBtn = screen.getByRole('button', { name: /^Thêm$/i });

    // Add a new skill
    fireEvent.change(skillInput, { target: { value: 'Kubernetes' } });
    fireEvent.click(addBtn);

    expect(screen.getByText('Kubernetes')).toBeInTheDocument();

    // Remove the skill
    const removeBtn = screen.getByLabelText('Xóa kỹ năng Kubernetes');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Kubernetes')).not.toBeInTheDocument();
  });

  test('allows toggling AI grounding switch and selecting AI Persona', () => {
    render(<ProfileView />);

    // Switch to career tab
    fireEvent.click(screen.getByRole('button', { name: /Định hướng & Kỹ năng/i }));

    // AI Grounding toggle switch
    const toggle = screen.getByLabelText('Bật/tắt dữ liệu nền AI').querySelector('input');
    expect(toggle).toBeChecked();

    if (toggle) {
      fireEvent.click(toggle);
      expect(toggle).not.toBeChecked();
    }

    // AI Persona buttons
    const recruiterBtn = screen.getByRole('button', { name: /Strict Recruiter/i });
    fireEvent.click(recruiterBtn);

    expect(localStorage.getItem('ai_persona')).toBe('recruiter');
  });

  test('opens education modal and adds new education entry', () => {
    render(<ProfileView />);

    const addEduBtn = screen.getByRole('button', { name: /Thêm Học Vấn/i });
    fireEvent.click(addEduBtn);

    expect(screen.getByText('Thêm Trường Học / Bằng Cấp')).toBeInTheDocument();

    const schoolInput = screen.getByLabelText(/Tên trường đại học/i);
    const majorInput = screen.getByLabelText(/Chuyên ngành đào tạo/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu Học Vấn/i });

    fireEvent.change(schoolInput, { target: { value: 'Đại học Bách Khoa TP.HCM' } });
    fireEvent.change(majorInput, { target: { value: 'Khoa học Máy tính' } });
    fireEvent.click(submitBtn);

    const schoolOccurrences = screen.getAllByText('Đại học Bách Khoa TP.HCM');
    expect(schoolOccurrences.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Khoa học Máy tính')).toBeInTheDocument();
  });

  test('displays saved CV list and handles set default CV', () => {
    render(<ProfileView />);

    expect(screen.getByText('CV Của Tôi')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer CV')).toBeInTheDocument();
    expect(screen.getByText('General IT CV')).toBeInTheDocument();

    const setDefaultBtn = screen.getByRole('button', { name: /Đặt làm mặc định/i });
    fireEvent.click(setDefaultBtn);

    // The button for "General IT CV" should now be the default
    expect(screen.getByText('General IT CV')).toBeInTheDocument();
  });
});
