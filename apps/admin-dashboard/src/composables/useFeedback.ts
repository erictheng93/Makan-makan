import { ref } from "vue";
import { api } from "@/services/api";
import { useToast } from "vue-toastification";
import { useI18n } from "@/i18n";

export interface FeedbackItem {
  id: number;
  restaurantId: string;
  userId: number;
  category: string;
  priority: string;
  status: string;
  relatedModule: string;
  subject: string;
  description: string;
  attachmentUrls: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  user?: { id: number; username: string; fullName?: string } | null;
  restaurant?: { id: string; name: string } | null;
  responses?: FeedbackResponseItem[];
}

export interface FeedbackResponseItem {
  id: number;
  feedbackId: number;
  userId: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user?: { id: number; username: string; fullName?: string } | null;
}

export interface FeedbackStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  avgResolutionTimeMs: number | null;
}

export interface FeedbackFilters {
  category?: string;
  status?: string;
  priority?: string;
  relatedModule?: string;
  restaurantId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateFeedbackPayload {
  subject?: string;
  description?: string;
  category?: string;
  priority?: string;
  relatedModule?: string;
  attachmentUrls?: string[];
}

export interface CreateFeedbackPayload {
  subject: string;
  description: string;
  category: string;
  priority?: string;
  relatedModule?: string;
  attachmentUrls?: string[];
}

export function useFeedback() {
  const toast = useToast();
  const { t } = useI18n();

  const isLoading = ref(false);
  const isSubmitting = ref(false);

  async function submitFeedback(payload: CreateFeedbackPayload) {
    isSubmitting.value = true;
    try {
      const res = await api.post("/feedback", payload);
      toast.success(t("feedback.submitSuccess"));
      return res.data.data as FeedbackItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.submitError"),
      );
      throw err;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function fetchFeedback(filters: FeedbackFilters = {}) {
    isLoading.value = true;
    try {
      // The list endpoint flattens its payload onto the envelope
      // ({ success, feedback, pagination }) rather than nesting under `data`,
      // so use the raw axios instance and type response.data to match.
      const res = await api.instance.get<{
        feedback: FeedbackItem[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/feedback", { params: filters });
      return res.data;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.loadError"),
      );
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchFeedbackById(id: number) {
    isLoading.value = true;
    try {
      const res = await api.get(`/feedback/${id}`);
      return res.data.data as FeedbackItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.loadError"),
      );
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      const res = await api.put(`/feedback/${id}/status`, { status });
      toast.success(t("feedback.statusUpdated"));
      return res.data.data as FeedbackItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.updateError"),
      );
      throw err;
    }
  }

  async function addResponse(
    id: number,
    message: string,
    isInternal: boolean = false,
  ) {
    try {
      const res = await api.post(`/feedback/${id}/responses`, {
        message,
        isInternal,
      });
      toast.success(t("feedback.replySuccess"));
      return res.data.data as FeedbackResponseItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.replyError"),
      );
      throw err;
    }
  }

  async function updateResponse(
    feedbackId: number,
    responseId: number,
    message: string,
  ) {
    try {
      const res = await api.put(
        `/feedback/${feedbackId}/responses/${responseId}`,
        { message },
      );
      return res.data.data as FeedbackResponseItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.updateError"),
      );
      throw err;
    }
  }

  async function deleteResponse(feedbackId: number, responseId: number) {
    try {
      await api.delete(`/feedback/${feedbackId}/responses/${responseId}`);
      toast.success(t("feedback.replyDeleted"));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.updateError"),
      );
      throw err;
    }
  }

  async function updateFeedback(id: number, payload: UpdateFeedbackPayload) {
    try {
      const res = await api.patch(`/feedback/${id}`, payload);
      toast.success(t("feedback.editSuccess"));
      return res.data.data as FeedbackItem;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.updateError"),
      );
      throw err;
    }
  }

  async function deleteFeedback(id: number) {
    try {
      await api.delete(`/feedback/${id}`);
      toast.success(t("feedback.deleteSuccess"));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.updateError"),
      );
      throw err;
    }
  }

  async function fetchStats() {
    try {
      const res = await api.get("/feedback/stats");
      return res.data.data as FeedbackStats;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? t("feedback.loadError"),
      );
      throw err;
    }
  }

  return {
    isLoading,
    isSubmitting,
    submitFeedback,
    fetchFeedback,
    fetchFeedbackById,
    updateStatus,
    addResponse,
    updateResponse,
    deleteResponse,
    updateFeedback,
    deleteFeedback,
    fetchStats,
  };
}
