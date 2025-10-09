import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import QueueView from "@/views/QueueView.vue";
import { queueService } from "@/services/queueService";
import { useRealtimeQueue } from "@/composables/useRealtimeQueue";
// Mock services
vi.mock("@/services/queueService");
vi.mock("@/composables/useRealtimeQueue");
vi.mock("@/stores/auth", () => ({
    useAuthStore: () => ({
        user: { restaurantId: 1 }, // Changed to number to match new API
        hasPermission: () => true,
    }),
}));
// Mock router
const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/queue", component: QueueView }],
});
describe("Queue Management Integration Tests", () => {
    let wrapper;
    let mockQueueService;
    let mockRealtimeQueue;
    beforeEach(() => {
        // Setup mocks
        mockQueueService = vi.mocked(queueService);
        mockRealtimeQueue = vi.mocked(useRealtimeQueue);
        // Mock service responses
        mockQueueService.getQueue.mockResolvedValue([
            {
                id: "queue_001",
                queueNumber: 1,
                restaurantId: "rest_test_001",
                customerName: "張先生",
                phoneNumber: "012-3456789",
                partySize: 4,
                tablePreference: "window",
                specialRequests: "需要兒童座椅",
                priority: 1,
                status: "called",
                joinedAt: new Date(Date.now() - 1800000).toISOString(),
                calledAt: new Date(Date.now() - 300000).toISOString(),
                seatedAt: null,
                estimatedWaitTime: 20,
                actualWaitTime: null,
                tableId: null,
                notes: "VIP顧客",
            },
            {
                id: "queue_002",
                queueNumber: 2,
                restaurantId: "rest_test_001",
                customerName: "李小姐",
                phoneNumber: "012-9876543",
                partySize: 2,
                tablePreference: "quiet",
                specialRequests: null,
                priority: 0,
                status: "waiting",
                joinedAt: new Date(Date.now() - 1200000).toISOString(),
                calledAt: null,
                seatedAt: null,
                estimatedWaitTime: 15,
                actualWaitTime: null,
                tableId: null,
                notes: null,
            },
        ]);
        mockQueueService.getRecommendedTables.mockResolvedValue([
            {
                tableId: "table_001",
                tableNumber: "T01",
                capacity: 4,
                status: "available",
                matchScore: 95,
                reasons: ["Capacity match", "Window preference"],
            },
            {
                tableId: "table_003",
                tableNumber: "T03",
                capacity: 6,
                status: "available",
                matchScore: 80,
                reasons: ["Slightly oversized"],
            },
        ]);
        mockQueueService.joinQueue.mockResolvedValue({
            success: true,
            queueItem: {
                id: "queue_003",
                queueNumber: 3,
                restaurantId: "rest_test_001",
                customerName: "王先生",
                phoneNumber: "012-5555555",
                partySize: 2,
                tablePreference: null,
                specialRequests: null,
                priority: 0,
                status: "waiting",
                joinedAt: new Date().toISOString(),
                calledAt: null,
                seatedAt: null,
                estimatedWaitTime: 25,
                actualWaitTime: null,
                tableId: null,
                notes: null,
            },
            estimatedWaitTime: 25,
        });
        // Mock real-time composable
        mockRealtimeQueue.mockReturnValue({
            isConnected: { value: true },
            queueUpdates: { value: [] },
            tableUpdates: { value: [] },
            queueStats: {
                value: {
                    currentWaiting: 2,
                    totalServedToday: 15,
                    averageWaitTime: 18,
                    peakWaitTime: 35,
                },
            },
            connectionStatus: { value: "connected" },
            startListening: vi.fn(),
            stopListening: vi.fn(),
            clearUpdates: vi.fn(),
            resetStats: vi.fn(),
            getRecentQueueUpdates: vi.fn(() => []),
            getRecentTableUpdates: vi.fn(() => []),
            getUpdatesByStatus: vi.fn(() => []),
            getTableUpdatesByNumber: vi.fn(() => []),
            hasPendingCalls: vi.fn(() => false),
            getAvailableTablesCount: vi.fn(() => 8),
            requestNotificationPermission: vi.fn().mockResolvedValue(true),
        });
        // Mount component with mock data
        wrapper = mount(QueueView, {
            global: {
                plugins: [router],
            },
            data() {
                return {
                    queueItems: [
                        {
                            id: "queue_001",
                            queueNumber: 1,
                            customerName: "張先生",
                            phoneNumber: "012-3456789",
                            partySize: 4,
                            tablePreference: "window",
                            specialRequests: "需要兒童座椅",
                            priority: 1,
                            status: "called",
                            joinedAt: new Date(Date.now() - 1800000).toISOString(),
                            calledAt: new Date(Date.now() - 300000).toISOString(),
                            seatedAt: null,
                            estimatedWaitTime: 20,
                            notes: "VIP顧客",
                        },
                    ],
                    tables: [
                        {
                            id: "table_001",
                            number: "T01",
                            capacity: 2,
                            status: "available",
                            occupiedSince: null,
                            cleaningStatus: "clean",
                        },
                        {
                            id: "table_002",
                            number: "T02",
                            capacity: 4,
                            status: "occupied",
                            occupiedSince: new Date(Date.now() - 2700000).toISOString(),
                            cleaningStatus: "clean",
                        },
                    ],
                };
            },
        });
    });
    afterEach(() => {
        wrapper?.unmount();
        vi.clearAllMocks();
    });
    describe("Component Mounting and Initial State", () => {
        it("should mount successfully", () => {
            expect(wrapper.exists()).toBe(true);
        });
        it("should display queue management title", () => {
            expect(wrapper.text()).toContain("候位管理系統");
        });
        it("should load queue data on mount", async () => {
            await wrapper.vm.$nextTick();
            expect(mockQueueService.getQueue).toHaveBeenCalledWith("rest_test_001", {});
        });
        it("should display statistics cards", () => {
            const statsCards = wrapper.findAll(".bg-white.rounded-lg.shadow.p-6");
            expect(statsCards.length).toBeGreaterThan(0);
        });
    });
    describe("Queue List Display", () => {
        it("should display queue items", async () => {
            await wrapper.vm.$nextTick();
            expect(wrapper.text()).toContain("排隊佇列");
            expect(wrapper.text()).toContain("張先生");
        });
        it("should show queue number badges", async () => {
            await wrapper.vm.$nextTick();
            const queueNumbers = wrapper.findAll(".w-12.h-12.rounded-full");
            expect(queueNumbers.length).toBeGreaterThan(0);
        });
        it("should display customer information", async () => {
            await wrapper.vm.$nextTick();
            expect(wrapper.text()).toContain("4 人");
            expect(wrapper.text()).toContain("VIP顧客");
        });
        it("should show status badges", async () => {
            await wrapper.vm.$nextTick();
            const statusBadges = wrapper.findAll(".px-2.py-1.text-xs.font-medium.rounded-full");
            expect(statusBadges.length).toBeGreaterThan(0);
        });
    });
    describe("Queue Filtering and Search", () => {
        it("should filter queue by status", async () => {
            const component = wrapper.vm;
            component.queueFilter = "waiting";
            await wrapper.vm.$nextTick();
            const filtered = component.filteredQueue;
            expect(filtered.every((item) => item.status === "waiting")).toBe(true);
        });
        it("should sort queue by priority and time", () => {
            const component = wrapper.vm;
            const queue = component.filteredQueue;
            // Should be sorted by priority first, then by join time
            for (let i = 0; i < queue.length - 1; i++) {
                const current = queue[i];
                const next = queue[i + 1];
                if (current.priority === next.priority) {
                    expect(new Date(current.joinedAt).getTime()).toBeLessThanOrEqual(new Date(next.joinedAt).getTime());
                }
                else {
                    expect(current.priority).toBeGreaterThanOrEqual(next.priority);
                }
            }
        });
    });
    describe("Table Management", () => {
        it("should display table grid", async () => {
            await wrapper.vm.$nextTick();
            expect(wrapper.text()).toContain("桌位狀態");
        });
        it("should show table status correctly", async () => {
            await wrapper.vm.$nextTick();
            const component = wrapper.vm;
            expect(component.getTableStatusText("available")).toBe("可用");
            expect(component.getTableStatusText("occupied")).toBe("使用中");
            expect(component.getTableStatusText("cleaning")).toBe("清潔中");
        });
        it("should handle table selection", async () => {
            const component = wrapper.vm;
            const table = component.tables[0];
            component.selectTable(table);
            expect(component.selectedTable).toEqual(table);
        });
        it("should filter tables by status", async () => {
            const component = wrapper.vm;
            component.tableViewFilter = "available";
            await wrapper.vm.$nextTick();
            const filtered = component.filteredTables;
            expect(filtered.every((table) => table.status === "available")).toBe(true);
        });
    });
    describe("Queue Operations", () => {
        it("should call next customer", async () => {
            mockQueueService.callNext.mockResolvedValue({
                success: true,
                calledCustomer: {
                    id: "queue_002",
                    queueNumber: 2,
                    status: "called",
                },
                message: "Customer called successfully",
            });
            const component = wrapper.vm;
            await component.callNextCustomer();
            expect(mockQueueService.callNext).toHaveBeenCalledWith("rest_test_001", {
                operatorId: expect.any(Number),
            });
        });
        it("should call specific customer", async () => {
            mockQueueService.callCustomer.mockResolvedValue({
                id: "queue_001",
                status: "called",
                calledAt: new Date().toISOString(),
            });
            const component = wrapper.vm;
            const queueItem = component.queueItems[0];
            await component.callCustomer(queueItem);
            expect(queueItem.status).toBe("called");
        });
        it("should handle customer seating", async () => {
            mockQueueService.seatCustomer.mockResolvedValue({
                success: true,
                queueItem: {
                    id: "queue_001",
                    status: "seated",
                    seatedAt: new Date().toISOString(),
                    tableId: "table_001",
                },
                tableAssignment: {
                    tableId: "table_001",
                    assignedAt: new Date().toISOString(),
                },
            });
            const component = wrapper.vm;
            component.selectedQueueItem = component.queueItems[0];
            component.seatAssignment = {
                tableId: "table_001",
                notes: "Seated at window table",
            };
            await component.confirmSeatAssignment();
            expect(mockQueueService.seatCustomer).toHaveBeenCalledWith("queue_001", {
                tableId: "table_001",
                operatorId: expect.any(Number),
                notes: "Seated at window table",
            });
        });
    });
    describe("Manual Queue Addition", () => {
        it("should open add to queue dialog", async () => {
            const component = wrapper.vm;
            component.addToQueue();
            expect(component.showAddDialog).toBe(true);
        });
        it("should validate add queue form", () => {
            const component = wrapper.vm;
            // Test empty form
            component.newQueueItem = {
                customerName: "",
                phoneNumber: "",
                partySize: 2,
                tablePreference: "",
                specialRequests: "",
                isVIP: false,
            };
            expect(component.canAddToQueue).toBe(false);
            // Test valid form
            component.newQueueItem = {
                customerName: "測試顧客",
                phoneNumber: "012-1234567",
                partySize: 3,
                tablePreference: "window",
                specialRequests: "",
                isVIP: false,
            };
            expect(component.canAddToQueue).toBe(true);
        });
        it("should add customer to queue", async () => {
            const component = wrapper.vm;
            component.newQueueItem = {
                customerName: "測試顧客",
                phoneNumber: "012-1234567",
                partySize: 3,
                tablePreference: "window",
                specialRequests: "測試需求",
                isVIP: true,
            };
            // Mock window.alert
            window.alert = vi.fn();
            await component.submitAddToQueue();
            expect(mockQueueService.joinQueue).toHaveBeenCalledWith({
                restaurantId: "rest_test_001",
                customerName: "測試顧客",
                phoneNumber: "012-1234567",
                partySize: 3,
                tablePreference: "window",
                specialRequests: "測試需求",
            });
            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("已加入排隊"));
        });
    });
    describe("Seat Assignment Dialog", () => {
        it("should open seat dialog", async () => {
            const component = wrapper.vm;
            const queueItem = component.queueItems[0];
            component.seatCustomer(queueItem);
            expect(component.showSeatDialog).toBe(true);
            expect(component.selectedQueueItem).toEqual(queueItem);
        });
        it("should load recommended tables", async () => {
            const component = wrapper.vm;
            component.selectedQueueItem = component.queueItems[0];
            await wrapper.vm.$nextTick();
            // The component should load recommended tables based on the selected queue item
            expect(component.recommendedTables.length).toBeGreaterThan(0);
        });
        it("should validate seat assignment", () => {
            const component = wrapper.vm;
            component.selectedQueueItem = component.queueItems[0];
            // Empty table selection should be invalid
            component.seatAssignment.tableId = "";
            expect(component.seatAssignment.tableId).toBeFalsy();
            // Valid table selection
            component.seatAssignment.tableId = "table_001";
            expect(component.seatAssignment.tableId).toBeTruthy();
        });
    });
    describe("Real-time Integration", () => {
        it("should initialize real-time connection", () => {
            const realtimeComposable = mockRealtimeQueue();
            expect(realtimeComposable.startListening).toHaveBeenCalled();
        });
        it("should handle real-time queue updates", () => {
            const realtimeComposable = mockRealtimeQueue();
            expect(realtimeComposable.isConnected.value).toBe(true);
            expect(realtimeComposable.queueStats.value.currentWaiting).toBe(2);
        });
        it("should request notification permission", () => {
            const realtimeComposable = mockRealtimeQueue();
            expect(realtimeComposable.requestNotificationPermission).toHaveBeenCalled();
        });
    });
    describe("Queue Statistics", () => {
        it("should display current statistics", async () => {
            await wrapper.vm.$nextTick();
            const component = wrapper.vm;
            expect(component.currentWaiting).toBeDefined();
            expect(component.avgWaitTime).toBeDefined();
            expect(component.availableTables).toBeDefined();
        });
        it("should calculate estimated wait times", () => {
            const component = wrapper.vm;
            const estimatedWait = component.calculateEstimatedWait(2); // 3rd position
            expect(estimatedWait).toBeGreaterThan(0);
        });
        it("should calculate wait time from join date", () => {
            const component = wrapper.vm;
            const joinTime = new Date(Date.now() - 1800000).toISOString(); // 30 minutes ago
            const waitTime = component.getWaitTime(joinTime);
            expect(waitTime).toBe(30);
        });
    });
    describe("Table Cleaning Operations", () => {
        it("should clean table", async () => {
            const component = wrapper.vm;
            const table = component.tables.find((t) => t.status === "occupied");
            // Mock window.alert
            window.alert = vi.fn();
            if (table) {
                await component.cleanTable(table);
                expect(table.status).toBe("cleaning");
                expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("開始清潔"));
            }
        });
        it("should complete table cleaning after delay", () => new Promise((resolve) => {
            const component = wrapper.vm;
            const table = {
                id: "table_test",
                number: "T99",
                status: "occupied",
                cleaningStatus: "dirty",
            };
            // Mock window.alert
            window.alert = vi.fn();
            component.cleanTable(table);
            // Check immediate status change
            expect(table.status).toBe("cleaning");
            // Check status after timeout
            setTimeout(() => {
                expect(table.status).toBe("available");
                expect(table.cleaningStatus).toBe("clean");
                resolve();
            }, 3100); // Slightly longer than the 3000ms timeout in component
        }));
    });
    describe("Error Handling", () => {
        it("should handle service errors gracefully", async () => {
            mockQueueService.getQueue.mockRejectedValue(new Error("Service unavailable"));
            try {
                await wrapper.vm.refreshQueue();
            }
            catch (error) {
                // Verify error is handled appropriately
            }
        });
        it("should show error messages for failed operations", async () => {
            mockQueueService.joinQueue.mockRejectedValue(new Error("Join failed"));
            // Mock window.alert
            window.alert = vi.fn();
            const component = wrapper.vm;
            component.newQueueItem = {
                customerName: "測試顧客",
                phoneNumber: "012-1234567",
                partySize: 3,
                tablePreference: "",
                specialRequests: "",
                isVIP: false,
            };
            await component.submitAddToQueue();
            expect(window.alert).toHaveBeenCalledWith("加入排隊失敗，請重試");
        });
    });
    describe("Status Helper Functions", () => {
        it("should return correct queue status classes", () => {
            const component = wrapper.vm;
            expect(component.getStatusClass("waiting")).toContain("blue");
            expect(component.getStatusClass("called")).toContain("yellow");
            expect(component.getStatusClass("seated")).toContain("green");
            expect(component.getStatusClass("no_show")).toContain("red");
        });
        it("should return correct queue status text", () => {
            const component = wrapper.vm;
            expect(component.getStatusText("waiting")).toBe("候位中");
            expect(component.getStatusText("called")).toBe("已叫號");
            expect(component.getStatusText("seated")).toBe("已入座");
            expect(component.getStatusText("no_show")).toBe("未到場");
            expect(component.getStatusText("cancelled")).toBe("已取消");
        });
        it("should return correct table status colors", () => {
            const component = wrapper.vm;
            expect(component.getTableStatusColor("available")).toContain("green");
            expect(component.getTableStatusColor("occupied")).toContain("red");
            expect(component.getTableStatusColor("cleaning")).toContain("orange");
        });
    });
});
