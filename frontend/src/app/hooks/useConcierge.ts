import { useState } from "react";
import { apiFetch, apiJson } from "../services/api";

const API_BASE = "/api/delivery/concierge";

export interface Address {
  _id?: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
  isDefault: boolean;
}

export function useConcierge(sessionId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = async (): Promise<Address[]> => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/addresses/${sessionId}`);
      const data = await res.json();
      return data.addresses || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const saveAddress = async (addressData: Address): Promise<Address[]> => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/addresses/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({ addressData })
      });
      const data = await res.json();
      return data.addresses || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const checkDelivery = async (city: string, deliveryDate: string, productId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/check`, {
        method: "POST",
        body: JSON.stringify({ city, deliveryDate, productId })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const checkNearestArea = async (city: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/nearest`, {
        method: "POST",
        body: JSON.stringify({ city })
      });
      const data = await res.json();
      return data.nearest;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchAddresses,
    saveAddress,
    checkDelivery,
    checkNearestArea
  };
}
