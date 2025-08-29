<?php
/**
 *
 * @author Vrataski
 * @date 2023-04-26
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
<?php 
// Initialize counter variable
$counter = 1;

// Helper function to display alert messages
function display_alert($alert_type, $message) {
  // Output the alert message with the given alert type (danger or success)
  echo "<div class=\"alert alert-$alert_type text-center\">
          <button class=\"close\">&times;</button>
          $message
        </div>";
}

// Helper function to display an employee row in the table
function display_employee_row($employee, $counter) {
  global $emp_status;
  // Output the employee details as a table row
  echo "<tr>
  		  <td>$counter</td>
          <td>{$employee['sol_name']}</td>
          <td>{$emp_status[$employee['sol_status']]}</td>
          <td>{$employee['sol_hp']}</td>
          <td>
            <a href='#edit_{$employee['sol_sn']}' class='btn btn-success btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-edit'></span> 修改</a>
            <a href='#delete_{$employee['sol_sn']}' class='btn btn-danger btn-sm' data-toggle='modal'><span class='glyphicon glyphicon-trash'></span> 刪除</a>
          </td>
        </tr>";
}
?>

<!-- Container for the entire page content -->
<div class="container">
  <!-- Page header/title -->
  <h1 class="page-header text-center">人員管理系統</h1>
  <div class="row">
    <div class="col-sm-8 col-sm-offset-2">
      
      <!-- Check if there is an error or success message in the session -->
      <?php
      // If an error message is present, display it using display_alert() and unset the session variable
      if(isset($_SESSION['error'])) {
        display_alert('danger', $_SESSION['error']);
        unset($_SESSION['error']);
      // If a success message is present, display it using display_alert() and unset the session variable
      } elseif(isset($_SESSION['success'])) {
        display_alert('success', $_SESSION['success']);
        unset($_SESSION['success']);
      }
      ?>

      <!-- Row for the add new employee and generate PDF buttons -->
      <div class="row">
        <!-- Add new employee button -->
        <a href="#addnew" data-toggle="modal" class="btn btn-primary"><span class="glyphicon glyphicon-plus"></span> 新增</a>
        <!-- Generate PDF button -->
        <a href="print_pdf.php" class="btn btn-success pull-right"><span class="glyphicon glyphicon-print"></span> PDF</a>
      </div>
      
      <!-- Spacer div -->
      <div class="height10"></div>

      <!-- Row for the employee table -->
      <div class="row">
        <!-- Employee table -->
        <table id="myTable" class="table table-bordered table-striped">
          <!-- Table header -->
          <thead>
			<th width="5%">序列</th>
            <th width="25%">使用者名稱</th>
            <th width="20%">使用者職稱</th>
            <th width="35%">使用者手機</th>
            <th width="20%">Action</th>
          </thead>
          <!-- Table body -->
          <tbody>
            <?php
			// Include the database connection file
			include_once('connection.php');

			// SQL query to select all employees from the database
			$sql = "SELECT * FROM employee WHERE shop_ID=?";

			// Prepare the SQL query
			$stmt = $conn->prepare($sql);

			// Bind the shop_ID parameter to the SQL query
			$stmt->bind_param('s', $kedai);

			// Execute the prepared statement
			$stmt->execute();

			// Get the result of the query
			$result = $stmt->get_result();

			// Fetch each employee row from the result and display it using display_employee_row()
			while($row = $result->fetch_assoc()){
				// Display the employee row in the table using the helper function
				display_employee_row($row, $counter);
				// Increment the counter
				$counter++;
				// Include the edit and delete modal templates for each employee
				include('edit_delete_modal.php');
			}
		?>

      </tbody>
    </table>
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
$(document).ready(function() {
  // Initialize the DataTable
  $('#myTable').DataTable();

  // Hide the alert
  $(document).on('click', '.close', function() {
    $('.alert').hide();
  });
});

</script>
</body>
</html>