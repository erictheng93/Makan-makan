<?php
/* 
這是personal文件夾裡面的index，處理的是人員管理系統
done by tyk 20221115 
*/
/* 取得Session的相關資料*/
	session_save_path('../session_data'); //把Session儲存在session_data的文件夾裡
	session_start(); //Session開始
	$kedai=$_SESSION['shop_ID']; //捉取shop_ID的Session
	$kedai_nama=$_SESSION['shop_name']; //捉取shop_name的Session
	$emp_status=array("admin","店主","廚師","送菜員","收銀員"); //給予emp_status一個一維陣列
?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>人員管理系統</title>
	<link rel="stylesheet" type="text/css" href="bootstrap/css/bootstrap.min.css">
	<link rel="stylesheet" type="text/css" href="datatable/dataTable.bootstrap.min.css">
	<style>
		.height10{
			height:10px;
		}
		.mtop10{
			margin-top:10px;
		}
		.modal-label{
			position:relative;
			top:7px
		}
	</style>
</head>
<body>
<!--這個是container區塊 開始-->
<div class="container">
	<!--這個是人員管理系統 區塊 開始-->
	<h1 class="page-header text-center">人員管理系統</h1>
	<div class="row">
		<div class="col-sm-8 col-sm-offset-2">
			<div class="row">
			<?php
				if(isset($_SESSION['error'])){ //如果Session捉到error的話
					echo
					"
					<div class='alert alert-danger text-center'> 
						<button class='close'>&times;</button>
						".$_SESSION['error']."
					</div>
					";
					unset($_SESSION['error']); //把這個Session error unset/destroys掉
				}
				if(isset($_SESSION['success'])){ //如果Session捉到success的話
					echo
					"
					<div class='alert alert-success text-center'>
						<button class='close'>&times;</button>
						".$_SESSION['success']."
					</div>
					";
					unset($_SESSION['success']); //把這個Session success unset/destroys掉
				}
			?>
			</div>
			<div class="row">
				<!-- #addnew是捉取bootstrap裡面的東西 -->
				<a href="#addnew" data-toggle="modal" class="btn btn-primary"><span class="glyphicon glyphicon-plus"></span> 新增</a>
				<!-- Directed to print_pdf.php -->
				<a href="print_pdf.php" class="btn btn-success pull-right"><span class="glyphicon glyphicon-print"></span> PDF</a>
			</div>
			<div class="height10">
			</div>
			<div class="row">
				<table id="myTable" class="table table-bordered table-striped">
					<thead>
						<th width="5%">ID</th>
						<th width="24%">使用者名稱</th>
						<th width="15%">使用者職稱</th>
						<th width="30%">使用者手機</th>
						<th width="25%">Action</th>
					<td width="1%"></thead>
					<tbody>
						<?php
							include_once('connection.php'); //帶connection.php進來一次
							$sql = "SELECT * FROM employee WHERE shop_ID='$kedai'"; 

							//use for MySQLi-OOP
							$query = $conn->query($sql);
							while($row = $query->fetch_assoc()){
								echo 
								"<tr>
									<td>".$row['sol_sn']."</td>
									<td>".$row['sol_name']."</td>
									<td>".$emp_status[$row['sol_status']]."</td>
									<td>".$row['sol_hp']."</td>
									<td>
										<a href='#edit_".$row['sol_sn']."' class='btn btn-success btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-edit'></span> 修改</a>
										<a href='#delete_".$row['sol_sn']."' class='btn btn-danger btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-trash'></span> 刪除</a>
									</td>
								</tr>";
								include('edit_delete_modal.php'); //加入edit_delete_modal.php
							}
							/////////////////

							//use for MySQLi Procedural
							// $query = mysqli_query($conn, $sql);
							// while($row = mysqli_fetch_assoc($query)){
							// 	echo
							// 	"<tr>
							// 		<td>".$row['id']."</td>
							// 		<td>".$row['firstname']."</td>
							// 		<td>".$row['lastname']."</td>
							// 		<td>".$row['address']."</td>
							// 		<td>
							// 			<a href='#edit_".$row['id']."' class='btn btn-success btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-edit'></span> Edit</a>
							// 			<a href='#delete_".$row['id']."' class='btn btn-danger btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-trash'></span> Delete</a>
							// 		</td>
							// 	</tr>";
							// 	include('edit_delete_modal.php');
							// }
							/////////////////

						?>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
<!--這個是container區塊 結束-->
<?php include('add_modal.php') ?>

<script src="jquery/jquery.min.js"></script>
<script src="bootstrap/js/bootstrap.min.js"></script>
<script src="datatable/jquery.dataTables.min.js"></script>
<script src="datatable/dataTable.bootstrap.min.js"></script>
<!-- generate datatable on our table -->
<script>
$(document).ready(function(){
	//inialize datatable
    $('#myTable').DataTable();

    //hide alert
    $(document).on('click', '.close', function(){
    	$('.alert').hide();
    })
});
</script>
</body>
</html>