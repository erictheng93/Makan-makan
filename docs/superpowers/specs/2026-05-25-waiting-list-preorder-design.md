# Spec: Waiting-list pre-order

## Objective

Let a customer with an active waiting-list ticket build one menu order before
being seated. The pre-order is attached to the ticket, stays out of the kitchen
queue while the customer is still waiting, and becomes a normal kitchen order
when staff seats the party.

## Lifecycle

- Create pre-order: `orders.waiting_list_id = ticket.id`,
  `orders.status = 'pending'`, `orders.table_id = NULL`,
  `orders.order_type = 'shop'`, and `delivery_info.type = 'dine_in'`.
- Waiting states: while the ticket is `waiting`, `called`, or `confirmed`, the
  pre-order is held and is not returned by kitchen active order queries.
- Seat ticket: `WaitingListService.markSeated(ticketId)` updates bound
  `pending` orders to `confirmed`, sets `table_id` to the assigned waiting-list
  table, and records `confirmed_at_ms`.
- Cancel or expire ticket: bound `pending` pre-orders are cancelled.

## Boundaries

- One active pre-order per waiting-list ticket in this phase.
- Public guest pre-order creation must prove ticket possession by matching
  `waitingListId + customerPhone`.
- Do not introduce a new order status; use existing `pending` as the held state.
- Existing table, seat, takeaway, and delivery order flows must remain unchanged.

## Verification

- Database/API/customer-app typecheck.
- API lint for changed route/service files.
- Customer i18n tests for any new copy.
- Kitchen active query remains `confirmed/preparing/ready`, so held pending
  pre-orders do not appear until seating.
