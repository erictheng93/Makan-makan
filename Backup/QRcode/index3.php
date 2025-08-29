<?php 

include_once 'phpqrcode/qrlib.php';


/**
 * png函数的参数：
 * $text：保存的文本内容；
 * $outfile：是否输出为文件，默认false
 * $level：纠错能力级别
 * $size：大小
 * $margin：边距
 * $saveandprint：是否保存并打印，默认false
 */
//QRCode::png('abc');
QRCode::png('abc1', 'abc1.jpg'); // 浏览器不输出，保存为图片
//QRCode::png('abc', false, QR_ECLEVEL_L, 10, 0);
QRCode::png('abc2', 'abc_2.jpg', QR_ECLEVEL_L, 10, 0, true);

?>