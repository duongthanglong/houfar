import os
users_name = [ 'bangcd@hou.edu.vn', 'dinhtuanlong@hou.edu.vn', 'duongthanglong@hou.edu.vn', 'huynt@hou.edu.vn',
               'thanhnv@hou.edu.vn', 'thaoltm@hou.edu.vn', 'thutl@hou.edu.vn', 'trantiendung.nd91@hou.edu.vn', 
               'sv1', 'sv2', 'sv3', 'sv4', 'sv5', 'sv6', 'sv7', 'sv8', 'sv9', 
               'sv10', 'sv11', 'sv12', 'sv13', 'sv14', 'sv15', 'sv16', 'sv17', 'sv18', 'sv19', 
               'sv20', 'sv21', 'sv22', 'sv23', 'sv24', 'sv25', 'sv26', 'sv27', 'sv28', 'sv29', 'sv30']

un_created = []
for un in users_name:
   if os.path.exists(un):
      print(f'Folder [{un}] is already EXISTS!')
   else:
      os.mkdir(un)
      un_created.append(un)
print('Created folders: ',un_created)
