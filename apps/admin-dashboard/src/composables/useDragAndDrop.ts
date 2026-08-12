import { ref } from "vue";

interface DragData {
  id: string;
  type: string;
  data: unknown;
}

export function useDragAndDrop() {
  const draggedItem = ref<DragData | null>(null);
  const isDragging = ref(false);
  const dropTarget = ref<string | null>(null);

  /**
   * 開始拖拽
   */
  const startDrag = (event: DragEvent, data: DragData) => {
    if (!event.dataTransfer) return;

    draggedItem.value = data;
    isDragging.value = true;

    // 設置拖拽效果
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";

    // 存儲數據
    event.dataTransfer.setData("application/json", JSON.stringify(data));

    // 添加自定義拖拽圖像（可選）
    if (event.target instanceof HTMLElement) {
      const dragImage = event.target.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = "0.7";
      dragImage.style.transform = "scale(0.95)";
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 0, 0);

      // 清理克隆的元素
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  };

  /**
   * 拖拽經過
   */
  const dragOver = (event: DragEvent, targetId?: string) => {
    event.preventDefault();

    if (!event.dataTransfer) return;

    // 設置拖拽效果
    event.dataTransfer.dropEffect = "move";

    // 更新放置目標
    if (targetId) {
      dropTarget.value = targetId;
    }
  };

  /**
   * 進入拖拽區域
   */
  const dragEnter = (event: DragEvent, targetId?: string) => {
    event.preventDefault();

    if (targetId) {
      dropTarget.value = targetId;
    }
  };

  /**
   * 離開拖拽區域
   */
  const dragLeave = (event: DragEvent, targetId?: string) => {
    event.preventDefault();

    if (targetId && dropTarget.value === targetId) {
      dropTarget.value = null;
    }
  };

  /**
   * 放置
   */
  const drop = (event: DragEvent, targetId?: string) => {
    event.preventDefault();

    if (!event.dataTransfer) return;

    try {
      const data = JSON.parse(event.dataTransfer.getData("application/json"));

      // 返回拖拽數據和目標ID
      return {
        dragData: data,
        targetId: targetId || null,
      };
    } catch (error) {
      console.error("Failed to parse drag data:", error);
      return null;
    } finally {
      // 清理狀態
      draggedItem.value = null;
      isDragging.value = false;
      dropTarget.value = null;
    }
  };

  /**
   * 拖拽結束
   */
  const dragEnd = () => {
    draggedItem.value = null;
    isDragging.value = false;
    dropTarget.value = null;
  };

  /**
   * 檢查是否為有效的放置目標
   */
  const isValidDropTarget = (targetId: string, dragType?: string): boolean => {
    if (!draggedItem.value) return false;
    if (dragType && draggedItem.value.type !== dragType) return false;
    return draggedItem.value.id !== targetId;
  };

  return {
    // 狀態
    draggedItem,
    isDragging,
    dropTarget,

    // 方法
    startDrag,
    dragOver,
    dragEnter,
    dragLeave,
    drop,
    dragEnd,
    isValidDropTarget,
  };
}

/**
 * 拖拽選項配置
 */
export interface DragOptions {
  onDragStart?: (data: DragData) => void;
  onDragEnd?: () => void;
  onDrop?: (dragData: DragData, targetId: string | null) => void;
  validateDrop?: (dragData: DragData, targetId: string | null) => boolean;
}

/**
 * 簡化的拖拽Hook（帶自動處理）
 */
export function useSimpleDragAndDrop(options: DragOptions = {}) {
  const {
    draggedItem,
    isDragging,
    dropTarget,
    startDrag: _startDrag,
    dragOver,
    dragEnter,
    dragLeave,
    drop: _drop,
    dragEnd: _dragEnd,
    isValidDropTarget,
  } = useDragAndDrop();

  const startDrag = (event: DragEvent, data: DragData) => {
    _startDrag(event, data);
    options.onDragStart?.(data);
  };

  const drop = (event: DragEvent, targetId?: string) => {
    const result = _drop(event, targetId);

    if (result) {
      // 驗證放置
      const isValid = options.validateDrop
        ? options.validateDrop(result.dragData, result.targetId)
        : true;

      if (isValid) {
        options.onDrop?.(result.dragData, result.targetId);
      }
    }
  };

  const dragEnd = () => {
    _dragEnd();
    options.onDragEnd?.();
  };

  return {
    draggedItem,
    isDragging,
    dropTarget,
    startDrag,
    dragOver,
    dragEnter,
    dragLeave,
    drop,
    dragEnd,
    isValidDropTarget,
  };
}
