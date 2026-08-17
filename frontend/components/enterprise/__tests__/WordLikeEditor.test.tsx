import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WordLikeEditor from '../WordLikeEditor';

describe('WordLikeEditor Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders toolbar with history, styles, formatting, lists, tables, and fullscreen buttons', () => {
    render(<WordLikeEditor initialContent="<p>Test Content</p>" onChange={mockOnChange} />);

    expect(screen.getByRole('toolbar', { name: /Soạn thảo văn bản/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Hoàn tác/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Làm lại/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Đậm/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Nghiêng/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Gạch chân/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Chèn bảng biểu/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Chèn liên kết/i)).toBeInTheDocument();
  });

  it('opens table modal and allows inserting a custom table', () => {
    render(<WordLikeEditor initialContent="<p>Content</p>" onChange={mockOnChange} />);

    const tableBtn = screen.getByTitle(/Chèn bảng biểu/i);
    fireEvent.click(tableBtn);

    expect(screen.getByText(/Chèn bảng biểu \(Tối đa 6 cột × 20 hàng\)/i)).toBeInTheDocument();
    const createTableBtn = screen.getByRole('button', { name: /Tạo bảng/i });
    expect(createTableBtn).toBeInTheDocument();

    fireEvent.click(createTableBtn);
    expect(screen.queryByText(/Chèn bảng biểu \(Tối đa 6 cột × 20 hàng\)/i)).not.toBeInTheDocument();
  });

  it('opens link modal and handles link input and cancellation', () => {
    render(<WordLikeEditor initialContent="<p>Content</p>" onChange={mockOnChange} />);

    const linkBtn = screen.getByTitle(/Chèn liên kết/i);
    fireEvent.click(linkBtn);

    expect(screen.getByText('Chèn liên kết')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/VD: Tìm hiểu thêm về công ty/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Chèn liên kết')).not.toBeInTheDocument();
  });

  it('opens style presets dropdown when clicked', () => {
    render(<WordLikeEditor initialContent="<p>Content</p>" onChange={mockOnChange} />);

    const styleDropdownBtn = screen.getByTitle(/Định dạng đoạn văn/i);
    fireEvent.click(styleDropdownBtn);

    expect(screen.getByText(/Heading 1 \(Tiêu đề lớn\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Heading 2 \(Tiêu đề vừa\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hộp ghi chú nổi bật \(Callout\)/i)).toBeInTheDocument();
  });
});
