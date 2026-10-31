// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StartClient } from './start-client';
const { link, useLink, track } = vi.hoisted(() => ({
  link: { installed: false, state: 'checking', tokenState: 'idle', extensionLinked: undefined, tokenError: null as null | { message: string }, retry: vi.fn() },
  useLink: vi.fn(), track: vi.fn(),
}));
vi.mock('@/lib/use-extension-link', () => ({ useExtensionLink: useLink }));
vi.mock('@/lib/signin-funnel', () => ({ trackSignin: track }));
vi.mock('@clerk/nextjs', () => ({
  GoogleOneTap: () => <span data-testid="google-one-tap" />,
  SignIn: (props: { forceRedirectUrl: string }) => <button data-return={props.forceRedirectUrl}>Sign in with Google or email</button>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  useLink.mockReturnValue(link);
  Object.assign(link, { installed: false, state: 'checking', tokenState: 'idle', extensionLinked: undefined, tokenError: null });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('/start', () => {
  it('shows demo, Google and email, returning to /start without starting token detection signed out', () => {
    render(<StartClient signedIn={false} name="" />);
    expect(screen.getByText('Ashita, mata aou.')).toBeTruthy();
    expect(screen.getByTestId('google-one-tap')).toBeTruthy();
    const signin = screen.getByRole('button', { name: 'Sign in with Google or email' });
    expect(signin.getAttribute('data-return')).toBe('/start');
    fireEvent.click(signin); fireEvent.click(signin);
    expect(track).toHaveBeenCalledWith('signin_gate_shown', 'start_page');
    expect(track.mock.calls.filter(c => c[0] === 'signin_started')).toHaveLength(1);
    expect(useLink).not.toHaveBeenCalled();
    expect(screen.getByText('FREE FOREVER. NO CARD.')).toBeTruthy();
  });
  it('uses the shared mint/detection controller when signed in', () => {
    Object.assign(link, { installed: true, state: 'installed', tokenState: 'ok' });
    render(<StartClient signedIn name="Learner" />);
    expect(useLink).toHaveBeenCalled();
    expect(screen.getByText(/The extension is connected/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Your words and reviews' }).getAttribute('href')).toBe('/app');
  });
  it('offers installation after detection times out', () => {
    link.state = 'missing';
    render(<StartClient signedIn name="Learner" />);
    expect(screen.getByRole('link', { name: 'Install the free Chrome extension' })).toBeTruthy();
  });
  it('reports token failure with an explicit retry', () => {
    Object.assign(link, { installed: true, state: 'installed', tokenState: 'failed', tokenError: { message: 'Connection failed.' } });
    render(<StartClient signedIn name="Learner" />);
    fireEvent.click(screen.getByRole('button', { name: 'Try connecting again' }));
    expect(link.retry).toHaveBeenCalledOnce();
  });
});
