# Run with Godot --headless --path ../survive-vampiror --script <absolute path> -- <web assets path>.
# Exports owned source scenes and their runtime-authored animations, without porting the engine.
extends SceneTree
var destination: String
var failed := false

func _initialize() -> void:
	destination = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(destination)
	call_deferred("run")

func write_asset(node: Node, filename: String) -> void:
	var document := GLTFDocument.new()
	document.visibility_mode = GLTFDocument.VISIBILITY_MODE_INCLUDE_OPTIONAL
	var state := GLTFState.new()
	var error := document.append_from_scene(node, state)
	if error == OK:
		error = document.write_to_filesystem(state, destination.path_join(filename + ".glb"))
	if error != OK:
		push_error("Asset export failed: %s (%d)" % [filename, error])
		failed = true
	else:
		print("Exported " + filename)

func run() -> void:
	var environment: Node = load("res://scenes/environments/arena_environment.tscn").instantiate()
	root.add_child(environment)
	write_asset(environment, "arena_environment")
	environment.free()
	for resource: String in ["halberd", "crossbow", "horse", "recruit_mantle", "environment/recruitment_crater", "environment/tombstone"]:
		var scene: Node = load("res://scenes/components/" + resource + ".tscn").instantiate()
		root.add_child(scene)
		write_asset(scene, resource.get_file())
		scene.free()
	for temporary: bool in [false, true]:
		var agent: Node = load("res://scenes/components/horde_agent.tscn").instantiate()
		agent.kind = 1 if temporary else 0
		root.add_child(agent)
		var visual: Node = agent.get_node("Visual")
		visual.get_node("MotionAir").free()
		visual.animation_player.stop()
		visual.skeleton.reset_bone_poses()
		write_asset(visual, "temporary_zombie" if temporary else "permanent_zombie")
		agent.free()
	for wave: int in [1, 2, 3]:
		var knight: Node = load("res://scenes/components/survivor.tscn").instantiate()
		root.add_child(knight)
		knight.configure_wave(wave, 800 + (wave - 1) * 200)
		var visual: Node = knight.get_node("Visual")
		for kind: int in range(5):
			if kind == 4 and wave < 3:
				continue
			knight.attack_kind = kind
			visual.attack([&"sweep", &"charge", &"spin", &"crossbow", &"rush"][kind], knight.current_windup(), knight.current_strike(), knight.current_recovery())
		visual.animation_player.stop()
		visual.skeleton.reset_bone_poses()
		visual.get_node("MotionAir").free()
		visual.rig.transform = Transform3D.IDENTITY
		visual.rotation = Vector3(0, PI, 0)
		write_asset(visual, "knight_wave%d" % wave)
		knight.free()
	var menu: Node = load("res://scenes/components/menu_diorama.tscn").instantiate()
	root.add_child(menu)
	write_asset(menu, "menu_diorama")
	menu.free()
	quit(1 if failed else 0)
