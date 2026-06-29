<script>
	import './styles.css';
	import '../app.css';
</script>

<div class="app">
	<main class='w-full'>
		<slot />
	</main>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		margin: 0 auto;
		box-sizing: border-box;
	}
</style>
