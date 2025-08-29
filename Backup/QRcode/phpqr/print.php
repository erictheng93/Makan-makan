<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
<style type="text/css">	
@media print {
  @page { margin: 0; }
  body { margin: 1.6cm; } 
}	
</style>	

</head>

<body>

	<div id="printableArea">
	<?php
		if (isset($_GET['k'])){
			$kedai=$_GET['k'];
		}
		if (isset($_GET['t'])){
			$meja=$_GET['t'];
		}
		require "config.php";
		if($meja=='a'){
		/* 選擇shop_info要顯示的物件 結束 */
			$sql2="SELECT * FROM shop_table WHERE st_shopID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
			$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
			$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
			for($i=0; $i<$number_result2; $i++){
				$ii=$i+1;
	 	echo "<img src='../image/$kedai-$ii.jpg' />";
	 	echo "&nbsp;&nbsp;&nbsp;&nbsp;";
	
			}
			
		
		}else{
		
			echo "<img src='../image/$kedai-$meja.jpg' />";
		}
		
	
		?>
	</div>	
<button onclick="printDiv('printableArea')">Print this page</button>
	<script language="javascript">
		function printDiv(divName){

    	var printContents = document.getElementById(divName).innerHTML;
		var originalContents = document.body.innerHTML;
    

		document.body.innerHTML = printContents;
    		window.print();
		document.body.innerHTML = originalContents;
    

}
	</script>

</body>
</html>