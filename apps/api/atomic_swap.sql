-- 使用 BEGIN IMMEDIATE 來強制原子性事務
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

-- 只處理核心的 5 個表
DROP TABLE users;
DROP TABLE categories;
DROP TABLE menu_items;
DROP TABLE tables;
DROP TABLE orders;

ALTER TABLE users_new RENAME TO users;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE tables_new RENAME TO tables;
ALTER TABLE orders_new RENAME TO orders;

COMMIT;
PRAGMA foreign_keys=ON;
