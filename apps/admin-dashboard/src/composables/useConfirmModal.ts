import { ref } from "vue";

export interface ConfirmModalOptions {
  type?: "danger" | "warning";
  title: string;
  message: string;
  confirmLabel: string;
}

export interface ConfirmModalState extends ConfirmModalOptions {
  type: "danger" | "warning";
  resolve: (confirmed: boolean) => void;
}

const modalState = ref<ConfirmModalState | null>(null);

export function useConfirmModal() {
  function confirm(options: ConfirmModalOptions): Promise<boolean> {
    return new Promise((resolve) => {
      modalState.value = {
        type: options.type ?? "danger",
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel,
        resolve,
      };
    });
  }

  function close(confirmed: boolean) {
    modalState.value?.resolve(confirmed);
    modalState.value = null;
  }

  return {
    modalState,
    confirm,
    close,
  };
}
