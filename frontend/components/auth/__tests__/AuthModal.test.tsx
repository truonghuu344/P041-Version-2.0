import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from '@/components/auth/AuthModal';

jest.mock('@/api-client.js', () => ({
  ApiClient: {
    register: jest.fn(),
    login: jest.fn(),
    googleAuth: jest.fn(),
    getUser: jest.fn(() => null),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  },
}));

jest.mock('@/lib/googleIdentity', () => ({
  loadGoogleIdentityServices: jest.fn(() => Promise.reject(new Error('offline test'))),
  getGoogleId: jest.fn(() => null),
}));

const replaceMock = jest.fn();

import { ApiClient } from '@/api-client.js';

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, replace: replaceMock, assign: jest.fn() },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  (ApiClient.getUser as jest.Mock).mockReturnValue(null);
  // Mặc định: khách đứng ở trang chủ.
  window.history.replaceState({}, '', '/');
});

function openModal(options?: { tab?: 'login' | 'register' }) {
  const utils = render(<AuthModal />);
  // Modal khởi đóng (guest ở '/'): mở qua đúng sự kiện cầu nối như caller thật.
  act(() => {
    document.dispatchEvent(
      new CustomEvent('authx:open', {
        detail: options?.tab ? { tab: options.tab } : {},
      }),
    );
  });
  return utils;
}

describe('AuthModal — shared login/register surface', () => {
  it('renders exactly ONE dialog with Đăng nhập | Đăng ký tabs (login default)', () => {
    openModal();

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByTestId('auth-tab-login')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('auth-tab-register')).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to the register tab INSIDE the same modal — no second dialog', async () => {
    const user = userEvent.setup();
    openModal();

    await user.click(screen.getByTestId('auth-tab-register'));

    expect(screen.getByTestId('register-role-choices')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('switches to the register tab from the helper line under the login CTA', async () => {
    const user = userEvent.setup();
    openModal();

    // Đúng MỘT link đăng ký dạng chữ dưới CTA, không phải nút CTA thứ hai.
    const helper = screen.getByTestId('login-to-register-link');
    expect(helper).toHaveTextContent('Đăng ký ngay');
    expect(screen.getAllByTestId('login-to-register-link')).toHaveLength(1);
    expect(helper.closest('p')).toHaveTextContent('Chưa có tài khoản? Đăng ký ngay');

    await user.click(helper);

    expect(screen.getByTestId('auth-tab-register')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('register-role-choices')).toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('keeps the helper line off the register pane (no duplicate register links)', async () => {
    const user = userEvent.setup();
    openModal();

    await user.click(screen.getByTestId('auth-tab-register'));

    expect(screen.queryByTestId('login-to-register-link')).not.toBeInTheDocument();
  });

  it('submits credentials via ApiClient.login and redirects by backend role', async () => {
    const user = userEvent.setup();
    (ApiClient.login as jest.Mock).mockResolvedValue({ access_token: 't' });
    (ApiClient.getUser as jest.Mock).mockReturnValue({ role: 'counselor' });

    openModal();

    await user.type(screen.getByLabelText('Email'), 'advisor@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));

    await waitFor(() => {
      expect(ApiClient.login).toHaveBeenCalledWith('advisor@example.com', 'secret123');
      // Backend role → portal (/student · /counselor · /admin).
      expect(replaceMock).toHaveBeenCalledWith('/counselor');
    });
  });

  it('shows inline feedback when login fails without navigating', async () => {
    const user = userEvent.setup();
    (ApiClient.login as jest.Mock).mockRejectedValue(new Error('Email hoặc mật khẩu không đúng.'));

    openModal();

    await user.type(screen.getByLabelText('Email'), 'a@b.vn');
    await user.type(screen.getByLabelText('Mật khẩu'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('offers forgot-password as an inner pane of the same modal', async () => {
    const user = userEvent.setup();
    openModal();

    await user.click(screen.getByTestId('forgot-password-link'));

    expect(screen.getByText('Quên mật khẩu?')).toBeInTheDocument();
    expect(screen.getByLabelText('Địa chỉ Email')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('walks the 3-step password reset using the existing reset APIs', async () => {
    const user = userEvent.setup();
    (ApiClient.requestPasswordReset as jest.Mock).mockResolvedValue({ message: 'ok' });
    (ApiClient.confirmPasswordReset as jest.Mock).mockResolvedValue({ message: 'done' });

    openModal();
    await user.click(screen.getByTestId('forgot-password-link'));

    await user.type(screen.getByLabelText('Địa chỉ Email'), 'student@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));

    expect(await screen.findByLabelText(/Mã xác thực OTP/)).toBeInTheDocument();
    expect(ApiClient.requestPasswordReset).toHaveBeenCalledWith('student@example.com');

    await user.type(screen.getByLabelText(/Mã xác thực OTP/), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác thực mã OTP' }));

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'newpassword1');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));

    await waitFor(() => {
      expect(ApiClient.confirmPasswordReset).toHaveBeenCalledWith(
        'student@example.com',
        '123456',
        'newpassword1',
      );
    });
  });
});

describe('AuthModal — register entry (account type)', () => {
  it('offers student and counselor activation choices', async () => {
    const user = userEvent.setup();
    openModal();
    await user.click(screen.getByTestId('auth-tab-register'));

    expect(screen.getByTestId('register-choice-student')).toBeInTheDocument();
    expect(screen.getByTestId('register-counselor-activation')).toBeInTheDocument();
    expect(screen.queryByTestId('register-choice-enterprise')).not.toBeInTheDocument();
  });

  it('never offers counselor or admin self-registration', async () => {
    const user = userEvent.setup();
    openModal();
    await user.click(screen.getByTestId('auth-tab-register'));

    const html = document.body.innerHTML;
    expect(html).not.toContain('register/counselor');
    expect(html).not.toContain('register/admin');
    await user.click(screen.getByTestId('register-counselor-activation'));
    expect(screen.getByTestId('register-counselor-activation')).toHaveTextContent('lời mời');
    expect(screen.queryByTestId('register-form')).not.toBeInTheDocument();
  });

  it('keeps an entered email when moving from login to register', async () => {
    const user = userEvent.setup();
    openModal();
    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByTestId('auth-tab-register'));
    await user.click(screen.getByTestId('register-choice-student'));
    expect(screen.getByLabelText(/^Email/)).toHaveValue('student@example.com');
  });

  it('states each role condition on its own card instead of one run-on hint', async () => {
    const user = userEvent.setup();
    openModal();
    await user.click(screen.getByTestId('auth-tab-register'));

    expect(screen.getByTestId('register-choice-student')).toHaveTextContent('Tự đăng ký miễn phí');
    expect(screen.getByTestId('register-counselor-activation')).toHaveTextContent('Cần lời mời');

    const choices = screen.getByTestId('register-role-choices');
    expect(choices.querySelector('.authx-choice-hint')).toBeNull();
  });

  it('slides the role panel forward on pick and backward on return', async () => {
    const user = userEvent.setup();
    const { container } = openModal();
    const host = () => container.querySelector('.authx-panel-host') as HTMLElement;

    await user.click(screen.getByTestId('auth-tab-register'));
    expect(host()).toHaveClass('is-tab');

    await user.click(screen.getByTestId('register-choice-student'));
    expect(host()).toHaveClass('is-fwd');
    // Panel mới phải là một node KHÁC, nếu không animation không chạy lại.
    expect(screen.getByTestId('register-form-view')).toBeInTheDocument();
    expect(screen.queryByTestId('register-role-choices')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chọn lại loại tài khoản' }));
    expect(host()).toHaveClass('is-back');
    expect(screen.getByTestId('register-role-choices')).toBeInTheDocument();
  });

  it('keeps focus inside the modal on panes that have no input', async () => {
    const user = userEvent.setup();
    const { container } = openModal();
    await user.click(screen.getByTestId('auth-tab-register'));

    // Bộ chọn vai trò không có input → focus phải nằm trong card, không rơi
    // về <body> (nếu rơi, Tab sẽ thoát ra trang phía sau modal).
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
    });
    expect(container.querySelector('.authx-card')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe('AuthModal — student registration', () => {
  async function goToStudentForm(user: ReturnType<typeof userEvent.setup>) {
    openModal();
    await user.click(screen.getByTestId('auth-tab-register'));
    await user.click(screen.getByTestId('register-choice-student'));
  }

  it('always registers with the backend-assigned STUDENT role', async () => {
    const user = userEvent.setup();
    (ApiClient.register as jest.Mock).mockResolvedValue({ role: 'student' });
    (ApiClient.login as jest.Mock).mockResolvedValue({ user: { role: 'student' } });
    (ApiClient.getUser as jest.Mock).mockReturnValue({ role: 'student' });

    await goToStudentForm(user);

    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyen Van A');
    await user.type(screen.getByLabelText(/^Email/), 'student@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret123');
    await user.click(screen.getByRole('button', { name: /Đăng ký Sinh viên/ }));

    await waitFor(() => {
      expect(ApiClient.register).toHaveBeenCalledWith(
        'student@example.com',
        'secret123',
        'Nguyen Van A',
        'student',
      );
    });
  });

  it('rejects short passwords before touching the API', async () => {
    const user = userEvent.setup();
    await goToStudentForm(user);

    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyen Van A');
    await user.type(screen.getByLabelText(/^Email/), 'student@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), '123');
    await user.click(screen.getByRole('button', { name: /Đăng ký Sinh viên/ }));

    expect(ApiClient.register).not.toHaveBeenCalled();
    expect(screen.getByTestId('register-feedback')).toHaveTextContent('tối thiểu 6 ký tự');
  });
});

describe('AuthModal — authx:open bridge event', () => {
  it('opens in place with a next hint when legacy callers dispatch the event', async () => {
    render(<AuthModal />);

    act(() => {
      document.dispatchEvent(
        new CustomEvent('authx:open', { detail: { next: '/find-jobs?q=cv' } }),
      );
    });

    expect(screen.getByTestId('login-form')).toBeVisible();
  });
});
