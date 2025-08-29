<?php 
/**
 *
 * @author Vrataski
 * @date 2023-04-26
 */

// Create an array called $emp_status containing different employee statuses
$emp_status = array("admin", "店主", "廚師", "送菜員", "收銀員");

// Use the count() function to find the length of the $emp_status array and store the value in the $arrLength variable
$arrLength = count($emp_status);
?>

<!-- This code creates a modal dialog that allows users to edit a member's information. -->
<div class="modal fade" id="edit_<?php echo $row['sol_sn']; ?>" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
    <!-- This is the modal dialog's header. -->
	<div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <center><h4 class="modal-title" id="myModalLabel">Edit Member</h4></center>
            </div>
			<!-- This is the modal dialog's body. -->
            <div class="modal-body">
			<div class="container-fluid">
			<!-- This is the form that users will use to edit the member's information. -->
			<form method="POST" action="edit.php">
				<!-- This hidden input field stores the member's ID. -->
				<input type="hidden" class="form-control" name="id" value="<?php echo $row['sol_sn']; ?>">
				<!-- This row of fields allows users to edit the member's name. -->
				<div class="row form-group">
					<div class="col-sm-2">						
						<label class="control-label modal-label">名稱:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="firstname" value="<?php echo $row['sol_name']; ?>">
					</div>
				</div>
				<!-- This row of fields allows users to edit the member's job title. -->
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">職稱:</label>
					</div>
					<div class="col-sm-10">					  
                        <select name="empStatus" id="select" class="form-control" >
							<?php 
							for($i=1;$i<$arrLength;$i++){
								if((int)$row['sol_status']==$i){
									$selected="selected";
								}else{
									$selected="";
								}
							?>
                          <option value="<?php echo $i?>" <?php echo $selected ?>><?php echo $emp_status[$i]?></option>
							<?php
								}
							?>
                        </select>
                    </div>
				</div>
				<!-- This row of fields allows users to edit the member's address. -->
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">地址:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="address" value="<?php echo $row['sol_adrress']; ?>">
					</div>
				</div>
				<!-- This row of fields allows users to edit the member's phone number. -->
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">手機:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="empMP" value="<?php echo $row['sol_hp']; ?>">
					</div>
				</div>
            </div> 
			</div>
			<!-- This is the modal dialog's footer. -->
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal"><span class="glyphicon glyphicon-remove"></span> Cancel</button>
                <button type="submit" name="edit" class="btn btn-success"><span class="glyphicon glyphicon-check"></span> Update</a>
			</form>
            </div>

        </div>
    </div>
</div>


<!-- This code creates a modal dialog that allows users to confirm the DELETION of a member's information. -->
<div class="modal fade" id="delete_<?php echo $row['sol_sn']; ?>" tabindex="-1" role="dialog" aria-labelledby="modalTitle" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <!-- This is the modal dialog's header. -->
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title text-center" id="modalTitle">職員資料刪除</h4>
      </div>

      <!-- This is the modal dialog's body. -->
      <div class="modal-body">
        <p class="text-center">確定刪除嗎??</p>
        <h2 class="text-center"><?php echo $row['sol_name'] . ' ' . $emp_status[$row['sol_status']]; ?></h2>
      </div>

      <!-- This is the modal dialog's footer. -->
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><span class="glyphicon glyphicon-remove"></span> Cancel</button>
        <a href="delete.php?id=<?php echo $row['sol_sn']; ?>" class="btn btn-danger"><span class="glyphicon glyphicon-trash"></span> Yes</a>
      </div>
    </div>
  </div>
</div>

