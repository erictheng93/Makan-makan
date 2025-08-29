-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- 主機： localhost
-- 產生時間： 2024-03-26 08:37:47
-- 伺服器版本： 8.0.33
-- PHP 版本： 8.2.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 資料庫： `makanmakan`
--

-- --------------------------------------------------------

--
-- 資料表結構 `category`
--

CREATE TABLE `category` (
  `cat_id` int NOT NULL,
  `category` varchar(25) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT ''
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

--
-- 傾印資料表的資料 `category`
--

INSERT INTO `category` (`cat_id`, `category`) VALUES
(1, '主食'),
(2, '飲料'),
(3, '小菜'),
(4, '甜品'),
(5, '小吃'),
(6, '配料'),
(7, '湯品'),
(8, '海鮮'),
(9, '燒烤'),
(10, '特色菜餚'),
(11, '火鍋'),
(12, '牛排'),
(13, '鐵板'),
(14, '其他');

-- --------------------------------------------------------

--
-- 資料表結構 `employee`
--

CREATE TABLE `employee` (
  `sol_sn` int NOT NULL COMMENT '序號',
  `sol_name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '使用者名稱',
  `sol_id` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '使用者賬號',
  `sol_pass` varchar(40) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '使用者密碼',
  `sol_status` int NOT NULL DEFAULT '1' COMMENT '使用者權限',
  `shop_ID` int NOT NULL COMMENT '商店代碼',
  `sol_adrress` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '店主地址',
  `sol_hp` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '店主手機'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Shop Owner Login';

--
-- 傾印資料表的資料 `employee`
--

INSERT INTO `employee` (`sol_sn`, `sol_name`, `sol_id`, `sol_pass`, `sol_status`, `shop_ID`, `sol_adrress`, `sol_hp`) VALUES
(1, 'AhBeng', 'beng', '12345', 1, 1111, '403台中市西屯區台灣大道二段459號14樓', '04 2328 6966'),
(2, 'Ali', 'ali', '12345', 1, 1112, '413台中市霧峰區中正路1126號', '04 2339 8835'),
(3, 'Muthu', 'muthu', '12345', 1, 1113, '413台中市霧峰區柳豐路342號', '0932 575 278'),
(5, 'James', 'jamie', '12345', 2, 1112, '413台中市霧峰區中正路1126號', '04 2339 8835'),
(6, 'Andrew', 'andrew', '12345', 2, 1113, '413台中市霧峰區柳豐路342號', '0932 575 278');

-- --------------------------------------------------------

--
-- 資料表結構 `shop_info`
--

CREATE TABLE `shop_info` (
  `shop_sn` int NOT NULL COMMENT '序號',
  `shop_ID` int NOT NULL COMMENT '商店代碼',
  `shop_name` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店名字',
  `shop_type` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店類別',
  `shop_category` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `shop_adrress` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店地址',
  `shop_district` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店所在區',
  `shop_hp` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店手機',
  `shop_available` int NOT NULL DEFAULT '1' COMMENT '商店是否開放	',
  `shop_logo` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店LOGO'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Table for new shop owner_info';

--
-- 傾印資料表的資料 `shop_info`
--

INSERT INTO `shop_info` (`shop_sn`, `shop_ID`, `shop_name`, `shop_type`, `shop_category`, `shop_adrress`, `shop_district`, `shop_hp`, `shop_available`, `shop_logo`) VALUES
(1, 1111, '大喇叭鐵板燒', '麻辣火鍋', '1,2,3,4,6,8,10,13', '403台中市西屯區台灣大道二段459號14樓', '西屯區', '04 2328 6966', 1, 'logo.png'),
(2, 1112, '品心港式飲茶', '鐵板燒類', '1,2,3,4,5,6,7', '413台中市霧峰區中正路1126號', '霧峰區', '04 2339 8835', 1, 'logo.png'),
(3, 1113, '大和拉麵製麵所', '麵食類', '2,7', '413台中市霧峰區柳豐路342號', '霧峰區', '0932 575 278', 1, 'logo.png'),
(4, 1114, '喜多麵', '定食類', '1,2,3,7', ' 413台中市霧峰區柳豐路369號', '霧峰區', '0911 611 559', 1, 'logo.png');

-- --------------------------------------------------------

--
-- 資料表結構 `shop_menu`
--

CREATE TABLE `shop_menu` (
  `menu_sn` int NOT NULL COMMENT '序號',
  `shop_ID` int NOT NULL COMMENT '商店代碼',
  `menu_foodname` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '食物名稱',
  `menu_pictures` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '食物照片',
  `menu_describe` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '食物簡介',
  `menu_price` decimal(10,2) NOT NULL COMMENT '食物價格',
  `menu_indoor` tinyint(1) NOT NULL DEFAULT '0' COMMENT '內用',
  `menu_outdoor` tinyint(1) NOT NULL COMMENT '外帶',
  `menu_available` int NOT NULL DEFAULT '1' COMMENT '商品是否開放：1=開放，0=不開放',
  `menu_recommended` int NOT NULL DEFAULT '0' COMMENT '是否招牌菜色：1=招牌，0=非招牌',
  `menu_ordered` int NOT NULL DEFAULT '0' COMMENT '商品已被點次數',
  `menu_remark` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '商品備註',
  `menu_category` int NOT NULL COMMENT '類別	',
  `menu_subCategory` int NOT NULL COMMENT '子類別	',
  `menu_nonveg` tinyint(1) DEFAULT NULL COMMENT '葷',
  `menu_wholeveg` tinyint(1) DEFAULT NULL COMMENT '全素',
  `menu_eggveg` tinyint(1) DEFAULT NULL COMMENT '蛋素',
  `menu_milkveg` tinyint(1) DEFAULT NULL COMMENT '奶素',
  `menu_eggmilkveg` tinyint(1) DEFAULT NULL COMMENT '蛋奶素',
  `menu_nonspices` tinyint(1) DEFAULT NULL COMMENT '不辣',
  `menu_spices` tinyint(1) DEFAULT NULL COMMENT '辣',
  `menu_spices1` tinyint(1) DEFAULT NULL COMMENT '小辣',
  `menu_spices2` tinyint(1) DEFAULT NULL COMMENT '中辣',
  `menu_spices3` tinyint(1) DEFAULT NULL COMMENT '大辣',
  `menu_UploadedTime` datetime DEFAULT NULL COMMENT '上傳時間'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Table for new shop owner_Menu';

--
-- 傾印資料表的資料 `shop_menu`
--

INSERT INTO `shop_menu` (`menu_sn`, `shop_ID`, `menu_foodname`, `menu_pictures`, `menu_describe`, `menu_price`, `menu_indoor`, `menu_outdoor`, `menu_available`, `menu_recommended`, `menu_ordered`, `menu_remark`, `menu_category`, `menu_subCategory`, `menu_nonveg`, `menu_wholeveg`, `menu_eggveg`, `menu_milkveg`, `menu_eggmilkveg`, `menu_nonspices`, `menu_spices`, `menu_spices1`, `menu_spices2`, `menu_spices3`, `menu_UploadedTime`) VALUES
(1, 1111, '黑森林蛋糕', '20221113113859s.jpg', '好吃美味又便宜的黑森林蛋糕', 450.00, 0, 1, 1, 1, 0, '此商品只限外帶，務必冷藏', 4, 18, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-13 00:00:00'),
(2, 1112, '草莓蛋糕', '20221113114457s.jpg', '擁有清新口味的草莓蛋糕', 450.00, 1, 0, 1, 0, 0, '只限外帶，請在一星期前訂做，此商品務必冷藏', 7, 18, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-13 00:00:00'),
(3, 1113, '蛋包飯', '20221113115142s.jpg', '蛋包飯是我們民間常吃的簡易製作的家常菜，可加辣椒', 30.00, 1, 1, 1, 0, 0, '福利商品，每人限點兩份', 2, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, '2022-11-13 00:00:00'),
(4, 1112, '可可飲', '20221113121140s.jpg', 'Made up by natural cocoa', 20.00, 1, 1, 1, 0, 0, '', 2, 9, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-13 00:00:00'),
(5, 1111, '舒芙蕾', '20221113121508s.jpg', '香噴噴的舒芙蕾，搭配糖分與糖漿\r\n超級美味\r\n歡迎嘗試', 50.00, 1, 1, 1, 1, 0, '可搭配套餐，嚐鮮價限定', 4, 17, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, '2022-11-13 00:00:00'),
(7, 1111, '羅漢果飲', '20221113124220s.jpg', '健康養生的羅漢果飲料', 15.00, 1, 1, 1, 0, 0, '', 2, 9, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-13 00:00:00'),
(8, 1113, '排骨', '20221113125531s.jpg', '香噴噴的豬肉排骨', 30.00, 1, 1, 1, 1, 0, '穆斯林禁用', 7, 33, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, '2022-11-13 00:00:00'),
(9, 1112, '炒粿條', '20221114033149s.JPG', '香噴噴的炒粿條唷', 70.00, 1, 1, 1, 1, 0, '限時限量', 1, 5, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, '2022-11-14 00:00:00'),
(10, 1113, '福建面', '20221114033331s.JPG', '使用蝦湯熬製的福建面', 70.00, 1, 1, 1, 1, 0, '限時限量', 2, 2, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, '2022-11-14 00:00:00'),
(11, 1111, '蛋塔', '20221120094517s.jpg', '好吃的蛋塔', 25.00, 1, 1, 1, 1, 0, '好吃的蛋塔', 4, 18, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(12, 1111, '肉夾饃', '20221120094646s.jpg', '好吃的肉夾饃', 50.00, 1, 1, 1, 0, 0, '好吃的肉夾饃', 3, 25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(13, 1111, '雲吞麵', '20221120094730s.JPG', '好吃的雲吞面', 5.00, 1, 1, 1, 1, 0, '雲吞面', 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(14, 1111, '椰漿飯', '20221120094804s.JPG', '好吃的椰漿飯', 2.00, 1, 1, 1, 1, 0, '好吃的椰漿飯', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(15, 1111, '港式大雜燴', '20221120094842s.jpg', '好吃的港式大雜燴', 260.00, 1, 0, 1, 1, 0, '好吃的港式大雜燴', 3, 25, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(16, 1111, '豬腸粉', '20221120094919s.jpg', '好吃的豬腸粉', 6.00, 1, 1, 1, 0, 0, '好吃的豬腸粉', 3, 25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(17, 1111, '蝦子春捲', '20221120094956s.JPG', '好吃的蝦子春捲', 9.50, 1, 1, 1, 0, 0, '好吃的蝦子春捲', 3, 25, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(18, 1111, '可不可', '20221120095051s.jpg', '好喝的可不可', 60.00, 1, 0, 1, 0, 0, '好喝的可不可', 2, 7, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(19, 1112, '港式排骨', '20221120095202s.jpg', '好吃的港式排骨', 6.00, 1, 0, 1, 0, 0, '好吃的港式排骨', 8, 25, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(20, 1112, '菊花茶', '20221120095229s.jpg', '好喝的菊花茶', 3.00, 1, 1, 1, 0, 0, '好喝的菊花茶', 2, 7, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(21, 1112, '水晶餃', '20221120095320s.JPG', '好吃的水晶餃', 6.50, 1, 0, 1, 1, 0, '好吃的水晶餃', 1, 25, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(22, 1112, '皮蛋粥', '20221120095405s.jpg', '好吃的皮蛋粥', 6.50, 1, 1, 1, 1, 0, '好吃的皮蛋粥', 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(23, 1112, '滿漢全席', '20221120095436s.jpg', '豪華的滿漢全席', 300.00, 1, 1, 1, 0, 0, '滿漢全席', 2, 25, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, '2022-11-20 00:00:00'),
(24, 1112, '草莓', '20221120095523s.jpg', '新鮮草莓', 30.50, 1, 1, 1, 0, 0, '新鮮草莓', 8, 16, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, '2022-11-20 00:00:00'),
(25, 1112, '小籠包', '20221120095602s.jpg', '新鮮出爐的小籠包', 9.50, 1, 1, 1, 1, 0, '新鮮出爐的小籠包', 7, 25, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, '2022-11-20 00:00:00');

-- --------------------------------------------------------

--
-- 資料表結構 `shop_order`
--

CREATE TABLE `shop_order` (
  `shopOrder_sn` int NOT NULL COMMENT '序號',
  `shopOrder_ID` int NOT NULL DEFAULT '0' COMMENT '每座的ID',
  `shopOrderMenu_ID` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '每座訂單的ID',
  `shop_ID` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店代碼',
  `shopOrder_table` varchar(3) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '食物桌號',
  `shopOrder_date` date NOT NULL COMMENT '用餐日期',
  `shopOrder_payTime` time DEFAULT NULL COMMENT '付錢時間',
  `shopOrder_price` float DEFAULT NULL COMMENT '食物總價格',
  `shopOrder_accountPerson` varchar(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT '1' COMMENT '收錢人代碼'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='shop_order table';

--
-- 傾印資料表的資料 `shop_order`
--

INSERT INTO `shop_order` (`shopOrder_sn`, `shopOrder_ID`, `shopOrderMenu_ID`, `shop_ID`, `shopOrder_table`, `shopOrder_date`, `shopOrder_payTime`, `shopOrder_price`, `shopOrder_accountPerson`) VALUES
(1, 1, '--20230513-1', '', '', '2023-05-13', NULL, NULL, '1'),
(2, 1, '1111-1-20230513-1', '1111', '1', '2023-05-13', NULL, NULL, '1'),
(3, 2, '1111-1-20230513-2', '1111', '1', '2023-05-13', NULL, NULL, '1');

-- --------------------------------------------------------

--
-- 資料表結構 `shop_ordermenu`
--

CREATE TABLE `shop_ordermenu` (
  `shopOrderMenu_sn` int NOT NULL COMMENT '序號',
  `shopOrderMenu_ID` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '訂單碼',
  `shopOrder_sn` int NOT NULL COMMENT '訂單的sn',
  `shop_ID` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '商店代碼',
  `shopOrder_table` varchar(3) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '食物桌號',
  `shopmenu_sn` int NOT NULL COMMENT '餐飲的sn',
  `shopOrder_date` date NOT NULL COMMENT '用餐日期',
  `shopOrder_Time` time DEFAULT NULL COMMENT '叫餐時間',
  `shopOrder_ItemPriceOrigin` float NOT NULL COMMENT '該食品單價',
  `shopOrder_ItemPriceTotal` float NOT NULL COMMENT '該食品總價',
  `shopOrder_ItemID` varchar(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT '1' COMMENT '收錢人代碼',
  `shopOrder_ItemName` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '菜名',
  `shopOrder_itemQuantity` int NOT NULL COMMENT '點菜數量',
  `shopOrder_note` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '葷/素,辣/不辣等記錄',
  `shopOrder_confirm` int DEFAULT NULL COMMENT '確認訂餐',
  `shopOrder_make` int DEFAULT NULL COMMENT '餐飲已經作完',
  `shopOrder_send` int DEFAULT NULL COMMENT '餐飲已經送出'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='shop_order table';

-- --------------------------------------------------------

--
-- 資料表結構 `shop_table`
--

CREATE TABLE `shop_table` (
  `st_sn` int NOT NULL COMMENT '序號',
  `shop_ID` int NOT NULL,
  `st_tableNumber` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `st_full` int NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

--
-- 傾印資料表的資料 `shop_table`
--

INSERT INTO `shop_table` (`st_sn`, `shop_ID`, `st_tableNumber`, `st_full`) VALUES
(2, 1111, '2', 0),
(3, 1111, '3', 0),
(4, 1111, '4', 0),
(5, 1111, '5', 0),
(6, 1112, '1', 0),
(7, 1112, '2', 0),
(8, 1112, '3', 0),
(9, 1112, '4', 0),
(11, 1113, '1', 0),
(12, 1113, '2', 0),
(13, 1113, '3', 0),
(14, 1113, '4', 0),
(15, 1113, '5', 0),
(16, 1113, '6', 0),
(17, 1113, '7', 0),
(18, 1113, '8', 0),
(19, 1113, '9', 0),
(20, 1113, '10', 0),
(1, 1111, '1', 0);

-- --------------------------------------------------------

--
-- 資料表結構 `subcategory`
--

CREATE TABLE `subcategory` (
  `subcat_id` int NOT NULL,
  `cat_id` int NOT NULL DEFAULT '0',
  `subcategory` varchar(25) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT ''
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- 傾印資料表的資料 `subcategory`
--

INSERT INTO `subcategory` (`subcat_id`, `cat_id`, `subcategory`) VALUES
(1, 1, '飯類'),
(2, 1, '麵類'),
(3, 1, '米粉類'),
(4, 1, '冬粉類'),
(5, 1, '粿條類'),
(6, 2, '咖啡類'),
(7, 2, '茶飲類'),
(8, 2, '碳酸飲料'),
(9, 2, '果菜汁類'),
(10, 2, '酒類'),
(11, 2, '醋類'),
(12, 2, '保健飲料'),
(13, 2, '礦泉水類'),
(14, 2, '特調飲料'),
(15, 2, '其他'),
(16, 3, '其他'),
(17, 4, '麵包'),
(18, 4, '蛋糕'),
(19, 4, '糕點'),
(20, 4, '餅干'),
(21, 4, '肉干'),
(22, 7, '鹹湯'),
(23, 7, '甜湯'),
(24, 7, '保健湯'),
(25, 5, '其他'),
(26, 6, '其他'),
(27, 8, '其他'),
(28, 9, '其他'),
(29, 10, '其他'),
(30, 11, '其他'),
(31, 12, '其他'),
(32, 13, '其他');

--
-- 已傾印資料表的索引
--

--
-- 資料表索引 `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`cat_id`);

--
-- 資料表索引 `employee`
--
ALTER TABLE `employee`
  ADD PRIMARY KEY (`sol_sn`);

--
-- 資料表索引 `shop_info`
--
ALTER TABLE `shop_info`
  ADD PRIMARY KEY (`shop_sn`);

--
-- 資料表索引 `shop_menu`
--
ALTER TABLE `shop_menu`
  ADD PRIMARY KEY (`menu_sn`);

--
-- 資料表索引 `shop_order`
--
ALTER TABLE `shop_order`
  ADD PRIMARY KEY (`shopOrder_sn`);

--
-- 資料表索引 `shop_ordermenu`
--
ALTER TABLE `shop_ordermenu`
  ADD PRIMARY KEY (`shopOrderMenu_sn`);

--
-- 資料表索引 `shop_table`
--
ALTER TABLE `shop_table`
  ADD PRIMARY KEY (`st_sn`);

--
-- 資料表索引 `subcategory`
--
ALTER TABLE `subcategory`
  ADD UNIQUE KEY `subcat_id` (`subcat_id`);

--
-- 在傾印的資料表使用自動遞增(AUTO_INCREMENT)
--

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `category`
--
ALTER TABLE `category`
  MODIFY `cat_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `employee`
--
ALTER TABLE `employee`
  MODIFY `sol_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號', AUTO_INCREMENT=14;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `shop_info`
--
ALTER TABLE `shop_info`
  MODIFY `shop_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號', AUTO_INCREMENT=5;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `shop_menu`
--
ALTER TABLE `shop_menu`
  MODIFY `menu_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號', AUTO_INCREMENT=26;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `shop_order`
--
ALTER TABLE `shop_order`
  MODIFY `shopOrder_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號', AUTO_INCREMENT=4;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `shop_ordermenu`
--
ALTER TABLE `shop_ordermenu`
  MODIFY `shopOrderMenu_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號';

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `shop_table`
--
ALTER TABLE `shop_table`
  MODIFY `st_sn` int NOT NULL AUTO_INCREMENT COMMENT '序號', AUTO_INCREMENT=21;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `subcategory`
--
ALTER TABLE `subcategory`
  MODIFY `subcat_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
