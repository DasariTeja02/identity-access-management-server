import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach session header if present
api.interceptors.request.use((config) => {
  const sid = localStorage.getItem('iam_session_id');
  if (sid) {
    config.headers['X-Session-Id'] = sid;
  }
  return config;
});

// Response interceptor to handle errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract formatted error message from backend ErrorResponse if available
    const errorData = error.response?.data;
    const message = errorData?.message || error.message || 'An unexpected error occurred.';
    const validationErrors = errorData?.validationErrors || null;

    return Promise.reject({
      status: error.response?.status,
      message,
      validationErrors,
      raw: error,
    });
  }
);

export const authService = {
  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

export const dashboardService = {
  async getSummary() {
    const response = await api.get('/dashboard/summary');
    return response.data;
  },
};

export const oauth2Service = {
  async getServerInfo() {
    const response = await api.get('/oauth2/server-info');
    return response.data;
  },

  async getClients() {
    const response = await api.get('/oauth2/clients');
    return response.data;
  },

  async getJwks() {
    const response = await axios.get('/oauth2/jwks');
    return response.data;
  },

  async requestClientCredentialsToken(clientId, clientSecret, scopes = 'read write') {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    if (scopes) {
      params.append('scope', scopes);
    }

    const authHeader = 'Basic ' + btoa(`${clientId}:${clientSecret}`);
    const response = await axios.post('/oauth2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
    });
    return response.data;
  },

  async callProtectedResource(token, endpoint = '/api/oauth2/protected/user') {
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

export const oidcService = {
  async getDiscoveryMetadata() {
    const response = await axios.get('/.well-known/openid-configuration');
    return response.data;
  },

  async getUserInfo(accessToken) {
    const response = await axios.get('/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.data;
  },

  async exchangeCodeForTokens({ code, codeVerifier, redirectUri, clientId = 'iam-web-client', clientSecret }) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (clientSecret) {
      headers['Authorization'] = 'Basic ' + btoa(`${clientId}:${clientSecret}`);
    }

    const response = await axios.post('/oauth2/token', params, { headers });
    return response.data;
  },

  async generatePkce() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const verifier = base64UrlEncode(array);

    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const challenge = base64UrlEncode(new Uint8Array(digest));

    return { verifier, challenge };
  },

  generateRandomString(length = 24) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
  },
};

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const sessionService = {
  async getSessions() {
    const response = await api.get('/sessions');
    return response.data;
  },

  async revokeSession(id) {
    const response = await api.post(`/sessions/${id}/revoke`);
    return response.data;
  },

  async logoutAll() {
    const response = await api.post('/sessions/logout-all');
    return response.data;
  },
};

export const adminSessionService = {
  async getAllSessions() {
    const response = await api.get('/admin/sessions');
    return response.data;
  },

  async revokeSession(id) {
    const response = await api.post(`/admin/sessions/${id}/revoke`);
    return response.data;
  },

  async revokeUserSessions(userId) {
    const response = await api.post(`/admin/users/${userId}/sessions/revoke`);
    return response.data;
  },

  async getSecurityEvents(userId) {
    const params = userId ? { userId } : {};
    const response = await api.get('/admin/security-events', { params });
    return response.data;
  },
};

export const mfaService = {
  async getStatus() {
    const response = await api.get('/mfa/status');
    return response.data;
  },

  async enroll() {
    const response = await api.post('/mfa/enroll');
    return response.data;
  },

  async verifyEnrollment(code) {
    const response = await api.post('/mfa/verify-enrollment', { code });
    return response.data;
  },

  async verifyChallenge(challengeToken, code, recoveryCode) {
    const response = await api.post('/mfa/challenge/verify', {
      challengeToken,
      code: code || null,
      recoveryCode: recoveryCode || null,
    });
    return response.data;
  },

  async disableMfa(password, code) {
    const response = await api.post('/mfa/disable', { password, code });
    return response.data;
  },

  async regenerateRecoveryCodes(password, code) {
    const response = await api.post('/mfa/recovery-codes/regenerate', { password, code });
    return response.data;
  },
};

export const adminMfaService = {
  async getAllUsers() {
    const response = await api.get('/admin/mfa/users');
    return response.data;
  },

  async resetUserMfa(userId) {
    const response = await api.post(`/admin/mfa/users/${userId}/reset`);
    return response.data;
  },
};

export const adminService = {
  async getStats() {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  async getUsers(params = {}) {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  async getUser(id) {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  async updateUserStatus(id, enabled) {
    const response = await api.patch(`/admin/users/${id}/status`, { enabled });
    return response.data;
  },

  async lockUser(id, reason = 'Administrative lockout') {
    const response = await api.post(`/admin/users/${id}/lock`, { reason });
    return response.data;
  },

  async unlockUser(id) {
    const response = await api.post(`/admin/users/${id}/unlock`);
    return response.data;
  },

  async updateUserRoles(id, roles) {
    const response = await api.patch(`/admin/users/${id}/roles`, { roles });
    return response.data;
  },

  async getRoles() {
    const response = await api.get('/admin/roles');
    return response.data;
  },

  async getAuthorities() {
    const response = await api.get('/admin/authorities');
    return response.data;
  },

  async createRole(data) {
    const response = await api.post('/admin/roles', data);
    return response.data;
  },

  async getUserSessions(id) {
    const response = await api.get(`/admin/users/${id}/sessions`);
    return response.data;
  },

  async revokeUserSession(id, sessionId) {
    const response = await api.delete(`/admin/users/${id}/sessions/${sessionId}`);
    return response.data;
  },

  async revokeAllUserSessions(id) {
    const response = await api.delete(`/admin/users/${id}/sessions`);
    return response.data;
  },

  async resetUserMfa(id) {
    const response = await api.post(`/admin/mfa/users/${id}/reset`);
    return response.data;
  },

  async getSecurityEvents(params = {}) {
    const response = await api.get('/admin/security-events', { params });
    return response.data;
  },
};

export default api;


