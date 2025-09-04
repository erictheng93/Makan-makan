# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMakan is a PHP-based restaurant management system that provides online ordering, menu management, table management, and multi-role user access. The system supports multiple restaurants/shops with their own menus, tables, and staff.

## Database Configuration

The system uses MySQL/MariaDB with the following setup:
- Database: `makanmakan`
- Configuration file: `config.php` (contains connection parameters)
- SQL schema: `SQL/makanmakan.sql`
- Default credentials: root/12345 (localhost)

To set up the database:
```bash
# Import the schema
mysql -u root -p makanmakan < SQL/makanmakan.sql
```

## Core System Architecture

### Multi-Role Access System
The system implements role-based access with different permission levels:
- 0: Admin
- 1: Shop Owner (店主)
- 2: Chef (廚師)  
- 3: Service Crew (送菜的service crew)
- 4: Cashier (收銀)

Authentication is handled through `login/checkpass.php` with session management.

### Main Modules

1. **Authentication System** (`login/`)
   - Login interface with Tailwind CSS styling
   - Session-based authentication
   - Multi-role authorization

2. **Menu Management** (`food/`)
   - Dynamic menu display using Foundation CSS framework
   - Category-based organization
   - Database-driven menu items

3. **Order Management** (`order/`)
   - Table-based ordering system
   - Order tracking and status management
   - Customer ordering interface

4. **Admin/Management Interface** (`login/`)
   - Product/menu item CRUD operations
   - Category management (`login/catedit/`)
   - User management (`login/personal/`)
   - QR code generation for tables (`login/phpqr/`)

### Database Tables
Key tables include:
- `employee`: Staff/user accounts with roles and shop assignments
- `shop_info`: Restaurant/shop information
- `shop_table`: Table management and availability
- `shop_order`: Order records
- `shop_menu`: Menu items per shop
- `category`: Menu categories

### File Organization
- `/config.php`: Database connection
- `/login/`: Authentication and admin interface
- `/food/`: Menu display system
- `/order/`: Customer ordering interface
- `/image/`: Static assets
- `/css/`: Stylesheets
- `/js/`: JavaScript files
- `/Backup/`: Various backup versions and legacy code

## Development Workflow

### Local Development
No build process required - this is a standard PHP application that runs directly on a web server.

To run locally:
1. Set up XAMPP/WAMP or similar PHP environment
2. Import database from `SQL/makanmakan.sql`
3. Update database credentials in `config.php`
4. Access via `http://localhost/makanmakan/`

### Testing
No automated test framework is configured. Manual testing through:
- Login interface: `login/login.php`
- Menu display: `food/index.php`
- Order system: `order/index.php?k=[shop_id]&m=[table_number]`

### Code Style
- Mixed Chinese and English comments
- Inline PHP with HTML
- Foundation CSS and Tailwind CSS for styling
- jQuery for JavaScript functionality

## Key Features
- Multi-shop support with individual menus and tables
- QR code-based table ordering
- Real-time order management
- Image upload for menu items
- Session-based table occupancy tracking
- PDF report generation (using TCPDF)

## Common Tasks
- Adding new menu items: Use `login/edit/productAdd1-2.php`
- Managing categories: Use `login/catedit/catedit.php`
- Table management: Configure through `shop_table` database table
- User management: Access via `login/personal/index.php`