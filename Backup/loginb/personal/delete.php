<?php
/* 人員管理系統
這個檔案是做刪除的
done by tyk 20221115 
*/

	session_start(); //Session開始
	include_once('connection.php'); //需求一次connection.php

	if(isset($_GET['id'])){ //如果捉到id的話
		$sql = "DELETE FROM employee WHERE sol_sn = '".$_GET['id']."'"; //執行刪除動作

		//use for MySQLi OOP
		if($conn->query($sql)){
			$_SESSION['success'] = '職員資料成功刪除'; //捉到success的session的話，就顯示資料刪除成功
		}else{
			$_SESSION['error'] = '刪除失敗'; //捉到error的session的話，就顯示資料刪除失敗
		}
	}
	else{
		$_SESSION['error'] = '先選擇員工後才刪除資料'; //如果什麼都沒捉到，就顯示先選擇再刪除資料
	}

	header('location: index.php'); //執行完畢後，跳轉index.php
?>