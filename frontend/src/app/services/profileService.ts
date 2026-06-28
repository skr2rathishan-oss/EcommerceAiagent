import { apiJson } from "../services/api";

export const getProfile = async () => {
  return apiJson("/api/profile");
};

export const updateProfile = async (payload: { name?: string; email?: string; mobile?: string }) => {
  return apiJson("/api/profile", { method: "PUT", body: JSON.stringify(payload) });
};

export const getDelivery = async () => {
  return apiJson("/api/delivery");
};

export const updateDelivery = async (payload: any) => {
  return apiJson("/api/delivery", { method: "PUT", body: JSON.stringify(payload) });
};

export const getPreferences = async () => {
  return apiJson("/api/preferences");
};

export const updatePreferences = async (payload: any) => {
  return apiJson("/api/preferences", { method: "PUT", body: JSON.stringify(payload) });
};

export const getLanguage = async () => {
  return apiJson("/api/language");
};

export const updateLanguage = async (payload: any) => {
  return apiJson("/api/language", { method: "PUT", body: JSON.stringify(payload) });
};

export const changePassword = async (payload: { currentPassword: string; newPassword: string }) => {
  return apiJson("/api/account/change-password", { method: "POST", body: JSON.stringify(payload) });
};

export const logout = async () => {
  return apiJson("/api/account/logout", { method: "POST" });
};

export default {
  getProfile,
  updateProfile,
  getDelivery,
  updateDelivery,
  getPreferences,
  updatePreferences,
  getLanguage,
  updateLanguage,
  changePassword,
  logout,
};
