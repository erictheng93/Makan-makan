<?php
/**
 * This code sets up the session variables for the shop.
 *
 * @author Vrataski
 * @date 2023-04-25
 */

// Set the session save path.
session_save_path('../session_data');
// Start the session.
session_start();
// Get the shop ID from the session.
$kedai = $_SESSION['shop_ID'];
// Get the shop name from the session.
$kedai_nama = $_SESSION['shop_name'];
// Create an array of employee statuses.
$emp_status = array("admin", "店主", "廚師", "送菜員", "收銀員");
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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>人員管理系統</title>
</head>
<body>
  <div class="container">
    <h1 class="page-header text-center">人員管理系統</h1>
    <div class="row">
      <div class="col-sm-8 col-sm-offset-2">
        <div class="row">
          <!-- Check if there is an error message in the session -->
          <?php if(isset($_SESSION['error'])): ?>
            <div class="alert alert-danger text-center">
              <button class="close">&times;</button>
              <?php echo $_SESSION['error']; ?>
            </div>
            <?php unset($_SESSION['error']); ?>
          <?php endif; ?>

          <!-- Check if there is a success message in the session -->
          <?php if(isset($_SESSION['success'])): ?>
            <div class="alert alert-success text-center">
              <button class="close">&times;</button>
              <?php echo $_SESSION['success']; ?>
            </div>
            <?php unset($_SESSION['success']); ?>
          <?php endif; ?>
        </div>
        <div class="row">
          <!-- Add new employee button -->
          <a href="#addnew" data-toggle="modal" class="btn btn-primary"><span class="glyphicon glyphicon-plus"></span> 新增</a>
          <!-- Generate PDF button -->
          <a href="print_pdf.php" class="btn btn-success pull-right"><span class="glyphicon glyphicon-print"></span> PDF</a>
        </div>
        <div class="height10">
        </div>
        <div class="row">
          <!-- Employee table -->
          <table id="myTable" class="table table-bordered table-striped">
            <thead>
              <th width="5%">ID</th>
              <th width="24%">使用者名稱</th>
              <th width="15%">使用者職稱</th>
              <th width="30%">使用者手機</th>
              <th width="25%">Action</th>
            </thead>
            <tbody>
              <!-- Get all employees from the database -->
              <?php
                include_once('connection.php');
                $sql = "SELECT * FROM employee WHERE shop_ID='$kedai'";

                // Use MySQLi-OOP
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
                  include('edit_delete_modal.php');
                }
              ?>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
<!-- Edit and delete modals -->
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