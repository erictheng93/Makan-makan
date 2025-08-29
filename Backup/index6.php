<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>CodePen - Responsive Tab Interface using jQuery and CSS</title>
  <link rel="stylesheet" href="./style.css">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
</head>
<body>
	<?php
	require "config.php";
	//require "config2.php";
	mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
	$sql="SELECT category FROM shopmenu_category";
	$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
	
	//不能用二維的array所以
	$menuOrigin=[]; //製作一個新的array，一個單一維度array
	foreach($result as $row){
	$menuOrigin[]=$row['category']; //這個就是把category裡面的物件用單維array call出來
	}	
	//$menuOrigin=array("主食", "飲料", "小菜", "甜品", "配料", "湯品", "其他", "確認訂單", "餐廳介紹");//從餐類別的資料讀出
	$menuShop=12345;//商家的餐品distinct
	$menuShop_arr = array_map('intval', str_split($menuShop));//把$menuShop轉成array
	//$menuShop_arr=array(1, 2, 3);
	//array_push($menuShop_arr, 8);
	//array_push($menuShop_arr, 9);
	$num_menuShop_arr=sizeof($menuShop_arr);
	print_r($menuOrigin); //顯示arr現況
	//print_r(sizeof($menuShop_arr)); //顯示這個arr裡面總共有5個東西，也就是1、4、6、8、9
	?>
<!-- partial:index.partial.html -->
<h1>Tab Box Using jQuery and CSS</h1>
 
<div class="tabBox">
  <ul class="tabs">
	  <?php
	  for($i=0; $i<$num_menuShop_arr; $i++){ //這個arr裡面是0到5
	  	$ii=$i+1;//因為tab不能為tab0而是從tab1開始,所以把$i+1;
		
		$menuShopNum=intval($menuShop_arr[$i])-1;//$i=0, intval($menuShop_arr[$i])給第0筆資料=1, 1-1=0; $i=1,intval($menuShop_arr[$i])給第1筆資料=4, 4-1=3;
	  ?>
    <li><a href="#tab<?php echo $ii ?>"><?php echo $menuOrigin[$menuShopNum] ?></a></li>
    <?php
	  }
	  ?>
  </ul>
 
  <div class="tabContainer">
	  <?php
	  for($i=0; $i<$num_menuShop_arr; $i++){ //這個arr裡面是0-5,也就是1、4、6、8、9
	  	$ii=$i+1; //因為tab不能為tab0而是從tab1開始,所以把$i+1;
		
		$menuShopNum=intval($menuShop_arr[$i])-1;
	  ?>
    <div id="tab<?php echo $ii ?>" class="tabContent">
      <?php echo $menuOrigin[$menuShopNum] ?>
		<iframe src="menu-<?php echo intval($menuShop_arr[$i]) ?>.php" width="100%" height="200" frameborder="0" scrolling="no"></iframe>
    </div>
     <?php
	  }
	  ?>
    
  </div>
</div> 

<!-- partial -->
  <script  src="./script.js"></script>

</body>
</html>
