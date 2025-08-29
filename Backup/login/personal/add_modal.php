<?php

	$kedai=$_SESSION['shop_ID'];
	$kedai_nama=$_SESSION['shop_name'];
	$emp_status=array("admin","店主","廚師","送菜員","收銀員");
?>
<!-- Add New -->
<div class="modal fade" id="addnew" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <center><h4 class="modal-title" id="myModalLabel"><?php echo $kedai_nama?>職員新增</h4></center>
            </div>
            <div class="modal-body">
			<div class="container-fluid">
			<form method="POST" action="add.php">
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">名稱:</label>
					</div>
					<div class="col-sm-10">
					  <input type="text" class="form-control" name="firstname" required>
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">職稱:</label>
					</div>
					<div class="col-sm-10">
						<select name="empStatus" id="select" class="form-control" >
							<?php 
							for($i=1;$i<$arrLength;$i++){
								
							?>
                          <option value="<?php echo $i?>" <?php echo $selected ?>><?php echo $emp_status[$i]?></option>
							<?php
								}
							?>
                        </select>
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">地址:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="address" required>
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">手機:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="empMP" required>
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">帳號:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="empID" required>
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">密碼:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="empPass" required>
					</div>
				</div>
            </div> 
			</div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal"><span class="glyphicon glyphicon-remove"></span> Cancel</button>
                <button type="submit" name="add" class="btn btn-primary"><span class="glyphicon glyphicon-floppy-disk"></span> Save</a>
			</form>
            </div>

        </div>
    </div>
</div>