# Read-only fixtures from the Godot source. Run under the source project's --path.
extends SceneTree
var result := {}
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var packed: PackedScene = load("res://scenes/main.tscn")
	var arena: Node = packed.instantiate()
	root.add_child(arena)
	arena.set_physics_process(false)
	arena.horde.set_physics_process(false)
	arena.survivor.health.current_health = 0
	arena.survivor.stop_combat()
	arena.horde.command_direction(Vector3(1, 0, -1).normalized())
	for step: int in range(60):
		arena.horde._physics_process(1.0 / 60.0)
	var positions := []
	for agent: Node3D in arena.horde.agents:
		positions.append([agent.position.x, agent.position.z])
	result["diagonal_one_second"] = positions
	arena.free()
	var corners := []
	for direction: Vector2 in [Vector2(-1, -1), Vector2(-1, 1), Vector2(1, -1), Vector2(1, 1)]:
		arena = packed.instantiate()
		root.add_child(arena)
		arena.set_physics_process(false)
		arena.horde.set_physics_process(false)
		arena.survivor.health.current_health = 0
		arena.survivor.stop_combat()
		arena.horde.command_direction(Vector3(direction.x, 0, direction.y).normalized())
		for step: int in range(1800):
			arena.horde._physics_process(1.0 / 60.0)
		var nearest: float = INF
		for a: Node3D in arena.horde.agents:
			for b: Node3D in arena.horde.agents:
				if a != b:
					nearest = minf(nearest, a.position.distance_to(b.position))
		corners.append({"x": direction.x, "z": direction.y, "nearest": nearest})
		arena.free()
	result["corners"] = corners
	var destination: String = OS.get_cmdline_user_args()[0]
	var file := FileAccess.open(destination, FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t"))
	print("Godot movement fixtures exported")
	quit()
