<?php
session_save_path("session_data"); //把成功login之後的session存在session data裡面
session_start(); //Session開始
	if(isset($_SESSION['check'])){
		if ($_SESSION['check']<>"ok") //看你登入的賬號密碼能不能對應到你SQL裡面所儲存的賬號密碼。這邊的session check是確保每一次管理人員進入下一個頁面tab1.php之前，是經過認證的而不是bookmark或者是儲存url來進入
		{
			header("location: login.php"); //如果對應不到的話，會去login.php
		}   
	}else{
			header("location: login.php");
	}     
?>