import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryView from '@/components/candidate/HistoryView';

describe('HistoryView Component (Redesigned)', () => {
  test('renders header with proper title and description', () => {
    render(<HistoryView />);

    expect(screen.getByRole('heading', { level: 2, name: /Lịch sử & Báo cáo/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Theo dõi kết quả CV, mức độ phù hợp công việc và quá trình luyện phỏng vấn/i)
    ).toBeInTheDocument();
  });

  test('renders 4 compact KPI summary cards', () => {
    render(<HistoryView />);

    const kpiSection = screen.getByLabelText(/Tổng quan số liệu/i);
    expect(within(kpiSection).getByText('Lần so khớp CV')).toBeInTheDocument();
    expect(within(kpiSection).getByText('CV đã tối ưu')).toBeInTheDocument();
    expect(within(kpiSection).getByText('Phiên phỏng vấn')).toBeInTheDocument();
    expect(within(kpiSection).getByText('Match cao nhất')).toBeInTheDocument();
  });

  test('renders analytics section with progress chart and activity donut containers', () => {
    render(<HistoryView />);

    expect(screen.getByText('Tiến bộ theo thời gian')).toBeInTheDocument();
    expect(screen.getByText('Hoạt động của bạn')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Match CV/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phỏng vấn/i })).toBeInTheDocument();
  });

  test('renders activity history table, search toolbar and filter dropdowns', () => {
    render(<HistoryView />);

    expect(screen.getByRole('heading', { level: 3, name: /Lịch sử hoạt động/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tìm CV, công việc hoặc công ty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lọc theo loại hoạt động/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lọc theo khoảng thời gian/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lọc theo trạng thái/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sắp xếp danh sách/i)).toBeInTheDocument();
  });

  test('renders data table headers and pagination controls', () => {
    render(<HistoryView />);

    expect(screen.getByRole('columnheader', { name: /Hoạt động/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^CV$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Công việc \/ JD/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Trạng thái/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Hành động/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/Phân trang/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Số bản ghi mỗi trang/i)).toBeInTheDocument();
  });

  test('renders right-side detail drawer structure with close button', () => {
    render(<HistoryView />);

    expect(screen.getByLabelText(/Bảng chi tiết hoạt động/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đóng chi tiết/i)).toBeInTheDocument();
  });
});
