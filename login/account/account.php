<?php
session_save_path('../session_data');
session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
//echo $shop_ID;
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

$sql0="SELECT * FROM shop_order WHERE shop_ID='$shop_ID' AND MONTH(shopOrder_date)= MONTH(now()) AND YEAR(shopOrder_date) = YEAR(now()) AND shopOrder_payTime IS NOT NULL ORDER BY shopOrder_date ASC";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
$total=0;
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
<table width="906" border="0" cellspacing="2" cellpadding="2">

    <tr>
	  <td width="115" bgcolor="#C0A86C">日期</td>
		<td width="110" bgcolor="#C0A86C">付錢時間</td>
      <td width="69" bgcolor="#C0A86C">流水號</td>
      <td width="79" bgcolor="#C0A86C">桌號</td>
      <td width="93" bgcolor="#C0A86C">當天疊集號</td>
      <td width="203" bgcolor="#C0A86C">每座訂單的ID</td>
      <td width="103" bgcolor="#C0A86C">食物總價格</td>
	  <td width="84" bgcolor="#C0A86C">收錢人代碼</td>
    </tr>
	<?php
		for($i=0; $i<$number_result0; $i++){
			$total=$total+$arr0[$i]['shopOrder_price'];
	?>
    <tr>
	  <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_date']?></td>
	  <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_payTime']?></td>
      <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_sn']?></td>
      <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_table']?></td>
      <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_ID']?></td>
      <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrderMenu_ID']?></td>
      <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_price']?></td>
	  <td bgcolor="#E7DEB3"><?php echo $arr0[$i]['shopOrder_accountPerson']?></td>
    </tr>
 <?php
		}
	?>
</table>	
	本月共<?php echo $total ?>經業額
</body>
</html>